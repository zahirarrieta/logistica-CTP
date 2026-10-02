import { apiFetch, apiPost, apiDelete, backendActivo, iniciarSesion } from './apiClient.js'
import { soloAdjuntosSolicitud } from '../utils/pdfUtils.js'
import { subirEvidenciaEntrega } from './archivosApi.js'

// Separador de las varias imágenes de evidencia de una entrega. Se usa '|' porque
// no aparece ni en dataUrls (base64) ni en las rutas del backend.
const SEP_EVIDENCIA = '|'

// Separador del campo `adjunto` del historial (la factura/remisión del «En
// Trámite»). El store lo escribe con `join(', ')`, así que se parte por coma.
const SEP_ADJUNTO = ','

// Normaliza a array de cadenas.
//
// El backend ya devuelve `adjuntos` como array (aArrayJson en routes.js) y
// `evidencia_url` como texto plano, así que en el camino normal esto es un
// simple envoltura. Pero una fila antigua puede traer el array serializado como
// texto, y ahí el fallo sería silencioso: la cadena '["a.pdf","b.pdf"]' se
// mandaría a /api/archivos/firmar como si fuera una sola ruta, el backend la
// descartaría por no pertenecer a ninguna solicitud, y el archivo aparecería sin
// forma de abrirse. Por eso se parsea.
function aTexto(valor) {
  if (Array.isArray(valor)) return valor.filter((v) => typeof v === 'string' && v)
  if (typeof valor !== 'string' || !valor.trim()) return []
  const texto = valor.trim()
  if (texto.startsWith('[')) {
    try {
      const parseado = JSON.parse(texto)
      if (Array.isArray(parseado)) return parseado.filter((v) => typeof v === 'string' && v)
    } catch {
      // No era JSON válido: se devuelve tal cual, que para las rutas del
      // servidor es justo lo correcto.
    }
  }
  return [texto]
}

// El alta del usuario la hace la pantalla de registro (POST /api/auth/registro),
// que es la que sabe la contraseña. Aquí ya solo hay sesiones abiertas.
async function preparar() {
  await iniciarSesion()
}

function filaDe(s) {
  return {
    codigo: s.id,
    fecha_subida: s.fechaSubida || '',
    hora_subida: s.horaSubida || '',
    tipo_solicitud: s.tipoSolicitud || '',
    cliente: s.cliente || '',
    nit: s.nit || '',
    bodega: s.bodega || '',
    zona: s.zona || '',
    cedula: s.cedula || '',
    orden_compra: s.ordenCompra || '',
    observaciones: s.observaciones || '',
    adjuntos: soloAdjuntosSolicitud(s.adjuntos),
    solicitante_nombre: s.nombreCompleto || '',
    solicitante_correo: (s.correo || '').toLowerCase(),
    estado: s.estado || 'Abierto',
    asignado_a: s.asignadoA || '',
    asignado_correo: (s.asignadoCorreo || '').toLowerCase(),
    conductor: s.conductor || '',
    conductor_correo: (s.conductorCorreo || '').toLowerCase(),
    vehiculo: s.vehiculo || '',
    placa: s.placa || '',
    numero_referencia: s.numeroReferencia || '',
    creado_por: (s.correo || '').toLowerCase(),
    pendiente_sync: Boolean(s.pendienteSync),
  }
}

function aLocal(fila, historial) {
  return {
    id: fila.codigo,
    fechaSubida: fila.fecha_subida,
    horaSubida: fila.hora_subida,
    nombreCompleto: fila.solicitante_nombre,
    correo: fila.solicitante_correo,
    tipoSolicitud: fila.tipo_solicitud,
    cliente: fila.cliente,
    bodega: fila.bodega,
    nit: fila.nit,
    zona: fila.zona,
    cedula: fila.cedula || '',
    ordenCompra: fila.orden_compra || '',
    observaciones: fila.observaciones,
    adjuntos: soloAdjuntosSolicitud(fila.adjuntos),
    estado: fila.estado,
    asignadoA: fila.asignado_a,
    asignadoCorreo: fila.asignado_correo || '',
    conductor: fila.conductor,
    conductorCorreo: fila.conductor_correo || '',
    vehiculo: fila.vehiculo,
    placa: fila.placa,
    numeroReferencia: fila.numero_referencia,
    pendienteSync: false,
    historial,
  }
}

function historialALocal(h, firmadas) {
  return {
    id: h.id,
    campo: h.campo,
    anterior: h.anterior,
    nuevo: h.nuevo,
    nota: h.nota,
    referencia: h.referencia,
    // La factura/remisión del «En Trámite» vive aquí y es una ruta del backend:
    // hay que firmarla igual que la evidencia, o el visor recibe la ruta cruda y
    // no carga nada.
    adjunto: firmarRutas(h.adjunto, firmadas, SEP_ADJUNTO),
    conductor: h.conductor,
    vehiculo: h.vehiculo,
    placa: h.placa,
    evidencia: firmarRutas(h.evidencia_url, firmadas, SEP_EVIDENCIA),
    encuesta: h.encuesta || null,
    persona: h.persona,
    fecha: h.fecha,
    hora: h.hora,
  }
}

function dataUrlABlob(dataUrl) {
  const [cabecera, contenido] = dataUrl.split(',')
  const mime = /data:(.*?);/.exec(cabecera)?.[1] || 'image/jpeg'
  const bin = atob(contenido)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return { blob: new Blob([bytes], { type: mime }), mime }
}

// Sube una imagen de evidencia al backend. El nombre lo genera el servicio de
// archivos (un sufijo único por subida) y el servidor lo sanea antes de escribir,
// de modo que dos evidencias del mismo pedido no se pisan.
async function subirEvidenciaParte(codigo, entrada, dataUrl, indice) {
  // El mime del Blob lo decide dataUrlABlob; el servicio de archivos lo lee de ahí
  // para elegir la extensión.
  const { blob } = dataUrlABlob(dataUrl)
  const referencia = `${entrada.referencia || entrada.id}_${indice}`
  const subida = await subirEvidenciaEntrega(blob, referencia, codigo)
  console.info(`[API] evidencia subida a evidencias/${subida.ruta}`)
  return subida.ruta
}

// Una entrega puede tener varias imágenes de evidencia unidas por SEP_EVIDENCIA.
// Las que aún no se han subido llegan como dataUrl (el conductor las fotografía
// sin conexión) y se suben aquí. Las rutas y direcciones ya guardadas se
// conservan tal cual. Devuelve el mismo formato unido.
async function resolverEvidencia(codigo, entrada) {
  const valor = typeof entrada.evidencia === 'string' ? entrada.evidencia.trim() : ''
  if (!valor) return ''
  const partes = valor.split(SEP_EVIDENCIA).map((p) => p.trim()).filter(Boolean)
  const resueltas = []
  for (let i = 0; i < partes.length; i += 1) {
    const parte = partes[i]
    resueltas.push(parte.startsWith('data:') ? await subirEvidenciaParte(codigo, entrada, parte, i) : parte)
  }
  return resueltas.join(SEP_EVIDENCIA)
}

// Sustituye cada ruta guardada por su URL firmada (24 h) y deja intactas las
// direcciones que ya son http (o los enlaces de OneDrive de los registros
// antiguos, que se detectan aparte en el visor). `sep` es el separador del campo:
// '|' para la evidencia de entrega, ',' para el adjunto (factura/remisión).
function firmarRutas(valor, firmadas, sep = SEP_EVIDENCIA) {
  return String(valor || '')
    .split(sep)
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u) => firmadas[u] || u)
    .join(sep)
}

// Trae las solicitudes y, de forma incremental, solo el historial de las que
// cambiaron desde `desde` (marca de agua = mayor `actualizado_en` visto). Las
// que no cambiaron conservan su historial local, así no se re-descargan miles
// de registros en cada inicio de sesión.
export async function descargarSolicitudes(desde = '') {
  if (!backendActivo) return null
  await preparar()

  const params = new URLSearchParams()
  if (desde) params.set('desde', desde)
  const consulta = params.toString() ? `?${params.toString()}` : ''

  // El backend ya devuelve las solicitudes paginadas por completo y el historial
  // solo de las que cambiaron, aplicando los mismos permisos que las políticas
  // RLS de Postgres.
  const datos = await apiFetch(`/api/solicitudes${consulta}`)
  const filas = datos.solicitudes || []
  const registros = datos.historial || []

  // Se piden firmas de TODO lo que es una ruta del backend y no un http: la
  // evidencia del historial, la factura/remisión del historial (campo `adjunto`)
  // Y los adjuntos de la solicitud. Antes solo se firmaban evidencia y adjuntos,
  // así que la factura del «En Trámite» llegaba al visor como ruta cruda y no se
  // podía abrir.
  const rutas = [
    ...new Set(
      [
        ...registros.flatMap((h) => aTexto(h.evidencia_url).flatMap((u) => u.split(SEP_EVIDENCIA))),
        ...registros.flatMap((h) => aTexto(h.adjunto).flatMap((u) => u.split(SEP_ADJUNTO))),
        ...filas.flatMap((f) => aTexto(f.adjuntos)),
      ]
        .map((u) => String(u || '').trim())
        .filter((u) => u && !/^https?:\/\//i.test(u) && !/^data:/i.test(u))
    ),
  ]
  const firmadas = {}
  if (rutas.length > 0) {
    try {
      const mapa = await apiPost('/api/archivos/firmar', { rutas })
      Object.assign(firmadas, mapa || {})
    } catch (error) {
      console.warn('[API] no se pudieron firmar los archivos:', error?.message)
    }
  }

  const porSolicitud = new Map()
  for (const h of registros) {
    const lista = porSolicitud.get(h.solicitud) || []
    lista.push(historialALocal(h, firmadas))
    porSolicitud.set(h.solicitud, lista)
  }

  console.info(
    `[API] descargadas ${filas.length} solicitud(es) y ${registros.length} registro(s) de historial`
    + (desde ? ' (incremental)' : ' (completo)')
  )
  return {
    solicitudes: filas.map((f) => {
      const local = aLocal(f, porSolicitud.get(f.codigo) || [])
      // Los adjuntos llegan como rutas y salen firmados, igual que la evidencia.
      local.adjuntos = local.adjuntos.map((u) => firmadas[u] || u)
      return local
    }),
    conHistorial: new Set(datos.conHistorial || []),
    watermark: datos.watermark || desde || '',
  }
}

// `crear` distingue un alta de una edición. El servidor lo necesita: si un alta
// llega a un código que ya existe tiene que rechazarla con 409, no convertirla
// en edición (eso pisaba la solicitud de otro usuario sin avisar). Sin el flag
// el backend no tiene forma de saberlo.
export async function empujarSolicitud(s, { crear = false } = {}) {
  if (!backendActivo || !s?.id) return false
  await preparar()

  const entradas = Array.isArray(s.historial) ? s.historial : []
  const filasHistorial = []
  for (const h of entradas) {
    const ruta = await resolverEvidencia(s.id, h)
    filasHistorial.push({
      id: h.id,
      solicitud: s.id,
      campo: h.campo || 'estado',
      anterior: h.anterior || '',
      nuevo: h.nuevo || '',
      nota: h.nota || '',
      referencia: h.referencia || '',
      adjunto: h.adjunto || '',
      conductor: h.conductor || '',
      vehiculo: h.vehiculo || '',
      placa: h.placa || '',
      evidencia_url: ruta,
      encuesta: h.encuesta || null,
      persona: h.persona || '',
      fecha: h.fecha || '',
      hora: h.hora || '',
    })
  }

  const fila = filaDe(s)
  // El backend valida los permisos (los que antes imponía RLS) y escribe la
  // solicitud y su historial en una sola transacción, así que ya no hace falta
  // el reintento por RPC cuando RLS rechazaba el INSERT.
  await apiPost('/api/solicitudes', {
    fila,
    historial: filasHistorial.filter((f) => f.id),
    crear,
  })

  console.info(
    `[API] guardada ${s.id} · estado "${fila.estado}"`
    + ` · ${filasHistorial.filter((f) => f.id).length} registro(s) de historial`
  )
  return true
}

export async function borrarSolicitud(codigo) {
  if (!backendActivo || !codigo) return false
  await preparar()
  await apiDelete(`/api/solicitudes/${encodeURIComponent(codigo)}`)
  console.info(`[API] borrada ${codigo}`)
  return true
}

export async function borrarTodasSolicitudes() {
  if (!backendActivo) return false
  await preparar()
  await apiDelete('/api/solicitudes')
  console.info('[API] borradas todas las solicitudes visibles')
  return true
}

export async function cargarClientes() {
  if (!backendActivo) return null
  await iniciarSesion()
  const data = await apiFetch('/api/clientes')
  console.info(`[API] cargados ${(data || []).length} cliente(s)`)
  return (data || []).map((c) => ({ ...c, cliente: c.nombre }))
}

export async function cargarUsuarios() {
  if (!backendActivo) return null
  await iniciarSesion()
  const data = await apiFetch('/api/usuarios')
  console.info(`[API] cargados ${(data || []).length} usuario(s)`)
  return data || []
}
