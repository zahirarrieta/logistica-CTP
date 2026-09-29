import { apiFetch, apiPost, apiDelete, backendActivo, iniciarSesion, datosUsuario } from './apiClient.js'
import { soloAdjuntosSolicitud } from '../utils/pdfUtils.js'
import { subirDocEntregaOneDrive } from './oneDriveApi.js'

// Separador de las varias imágenes de evidencia de una entrega. Se usa '|' porque
// no aparece ni en dataUrls (base64) ni en las URLs de OneDrive/SharePoint.
const SEP_EVIDENCIA = '|'

let usuarioRegistrado = false

// El alta del usuario se hace una vez por sesión de navegador. El rol llega
// vacío: lo asigna un administrador después (el backend no acepta que el propio
// usuario se auto-asigne permisos).
async function preparar() {
  await iniciarSesion()
  if (usuarioRegistrado) return
  const { correo, nombre } = datosUsuario()
  if (!correo) return
  usuarioRegistrado = true
  try {
    await apiPost('/api/usuarios/registro', { nombre })
  } catch {
    // Si no se pudo registrar, el resto de la sincronización sigue intentándolo.
  }
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

function historialALocal(h, evidencia) {
  return {
    id: h.id,
    campo: h.campo,
    anterior: h.anterior,
    nuevo: h.nuevo,
    nota: h.nota,
    referencia: h.referencia,
    adjunto: h.adjunto,
    conductor: h.conductor,
    vehiculo: h.vehiculo,
    placa: h.placa,
    evidencia,
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

// Sube una imagen de evidencia al backend. El nombre lo genera el servidor a
// partir del id del historial y el índice, igual que la ruta que se armaba para
// el disco del servidor.
async function subirEvidenciaParte(codigo, id, dataUrl, indice) {
  const { blob, mime } = dataUrlABlob(dataUrl)
  const extension = mime.includes('pdf') ? 'pdf' : 'jpg'
  const nombre = `${id}_${indice}.${extension}`
  const cuerpo = new FormData()
  cuerpo.append('archivo', blob, nombre)
  cuerpo.append('codigo', codigo)
  cuerpo.append('nombre', nombre)
  const { ruta } = await apiFetch('/api/archivos/evidencia', { method: 'POST', body: cuerpo })
  console.info(`[API] evidencia subida a evidencias/${ruta}`)
  return ruta
}

// Una entrega puede tener varias imágenes de evidencia unidas por SEP_EVIDENCIA.
// Al sincronizar se REEINTENTA primero la carpeta compartida de OneDrive/SharePoint
// del usuario (misma ruta que el flujo en línea); solo si falla se sube al
// backend como respaldo. Las URLs http/rutas ya subidas se conservan tal cual.
// Devuelve el mismo formato unido.
async function resolverEvidencia(codigo, entrada, solicitud) {
  const valor = typeof entrada.evidencia === 'string' ? entrada.evidencia.trim() : ''
  if (!valor) return ''
  const partes = valor.split(SEP_EVIDENCIA).map((p) => p.trim()).filter(Boolean)
  const esEntrega = ['Entregado', 'Entregado Parcial'].includes(entrada.nuevo || '')
  const resueltas = []
  for (let i = 0; i < partes.length; i += 1) {
    const parte = partes[i]
    if (!parte.startsWith('data:') || !esEntrega) {
      resueltas.push(
        parte.startsWith('data:')
          ? await subirEvidenciaParte(codigo, entrada.id, parte, i)
          : parte
      )
      continue
    }
    try {
      const subida = await subirDocEntregaOneDrive(
        dataUrlABlob(parte).blob,
        solicitud.numeroReferencia || codigo,
        solicitud.nombreCompleto,
        codigo
      )
      if (!subida?.url) throw new Error('OneDrive no devolvió un enlace')
      resueltas.push(subida.url)
    } catch (err) {
      console.warn('[OneDrive] reintento de evidencia a SharePoint falló, se sube al backend:', err.message)
      resueltas.push(await subirEvidenciaParte(codigo, entrada.id, parte, i))
    }
  }
  return resueltas.join(SEP_EVIDENCIA)
}

// Sustituye cada ruta guardada por su URL firmada (24 h) y deja intactas las
// URLs http de OneDrive.
function firmarEvidencia(evidenciaUrl, firmadas) {
  return String(evidenciaUrl || '')
    .split(SEP_EVIDENCIA)
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u) => firmadas[u] || u)
    .join(SEP_EVIDENCIA)
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

  const rutas = [
    ...new Set(
      registros
        .flatMap((h) => String(h.evidencia_url || '').split(SEP_EVIDENCIA))
        .map((u) => u.trim())
        .filter((u) => u && !/^https?:\/\//i.test(u))
    ),
  ]
  const firmadas = {}
  if (rutas.length > 0) {
    try {
      const mapa = await apiPost('/api/archivos/firmar', { rutas })
      Object.assign(firmadas, mapa || {})
    } catch (error) {
      console.warn('[API] no se pudieron firmar las evidencias:', error?.message)
    }
  }

  const porSolicitud = new Map()
  for (const h of registros) {
    const lista = porSolicitud.get(h.solicitud) || []
    lista.push(historialALocal(h, firmarEvidencia(h.evidencia_url, firmadas)))
    porSolicitud.set(h.solicitud, lista)
  }

  console.info(
    `[API] descargadas ${filas.length} solicitud(es) y ${registros.length} registro(s) de historial`
    + (desde ? ' (incremental)' : ' (completo)')
  )
  return {
    solicitudes: filas.map((f) => aLocal(f, porSolicitud.get(f.codigo) || [])),
    conHistorial: new Set(datos.conHistorial || []),
    watermark: datos.watermark || desde || '',
  }
}

export async function empujarSolicitud(s) {
  if (!backendActivo || !s?.id) return false
  await preparar()

  const entradas = Array.isArray(s.historial) ? s.historial : []
  const filasHistorial = []
  for (const h of entradas) {
    const ruta = await resolverEvidencia(s.id, h, s)
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

// Devuelve { correo, nombre, rol } del usuario autenticado actual, o null si no
// está registrado en la tabla usuarios. El backend limita la lectura a su propia
// fila salvo que sea administrador.
export async function cargarUsuarioActual() {
  if (!backendActivo) return null
  await preparar()
  const { correo } = datosUsuario()
  if (!correo) return null
  try {
    const propio = await apiFetch('/api/usuarios/yo')
    if (!propio) return null
    return { correo: propio.correo, nombre: propio.nombre, rol: propio.rol }
  } catch (error) {
    console.warn('[API] no se pudo leer el rol del usuario actual:', error?.message)
    return null
  }
}
