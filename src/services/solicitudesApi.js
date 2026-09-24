import { supabase, iniciarSesion, datosUsuario, backendActivo } from './supabaseClient.js'
import { soloAdjuntosSolicitud } from '../components/pdfUtils.js'

const EXPIRA_EVIDENCIA = 60 * 60 * 24 // 24 h

let usuarioRegistrado = false

async function preparar() {
  await iniciarSesion()
  if (usuarioRegistrado) return
  const { correo, nombre } = datosUsuario()
  if (!correo) return
  usuarioRegistrado = true
  try {
    await supabase.from('usuarios').upsert({ correo, nombre }, { onConflict: 'correo', ignoreDuplicates: true })
  } catch {
    // Si no se pudo registrar el usuario, el resto de la sincronización sigue intentándolo.
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

async function subirEvidencia(codigo, entrada) {
  const { blob, mime } = dataUrlABlob(entrada.evidencia)
  const extension = mime.includes('pdf') ? 'pdf' : 'jpg'
  const ruta = `${codigo}/${entrada.id}.${extension}`
  const { error } = await supabase.storage
    .from('evidencias')
    .upload(ruta, blob, { contentType: mime, upsert: true })
  if (error) throw error
  console.info(`[Supabase] evidencia subida a evidencias/${ruta}`)
  return ruta
}

// Trae las solicitudes y, de forma incremental, solo el historial de las que
// cambiaron desde `desde` (marca de agua = mayor `actualizado_en` visto). Las
// que no cambiaron conservan su historial local, así no se re-descargan miles
// de registros en cada inicio de sesión.
export async function descargarSolicitudes(desde = '') {
  if (!backendActivo) return null
  await preparar()

  const { data, error } = await supabase
    .from('solicitudes')
    .select('*')
    .order('actualizado_en', { ascending: false })
    .limit(1000)
  if (error) throw error

  const filas = data || []
  const watermark = filas.reduce(
    (acc, f) => (f.actualizado_en && f.actualizado_en > acc ? f.actualizado_en : acc),
    desde || ''
  )

  const codigos = desde
    ? filas.filter((f) => f.actualizado_en && f.actualizado_en > desde).map((f) => f.codigo)
    : filas.map((f) => f.codigo)

  let registros = []
  if (codigos.length > 0) {
    const { data: dataHist, error: errorHist } = await supabase
      .from('historial')
      .select('*')
      .in('solicitud', codigos)
      .order('creado_en', { ascending: false })
    if (errorHist) throw errorHist
    registros = dataHist || []
  }

  const rutas = [
    ...new Set(
      registros
        .map((h) => h.evidencia_url)
        .filter((u) => u && !/^https?:\/\//i.test(u))
    ),
  ]
  const firmadas = {}
  if (rutas.length > 0) {
    const { data, error: errorUrl } = await supabase.storage
      .from('evidencias')
      .createSignedUrls(rutas, EXPIRA_EVIDENCIA)
    if (!errorUrl && Array.isArray(data)) {
      data.forEach((d, i) => {
        if (d?.signedUrl) firmadas[rutas[i]] = d.signedUrl
      })
    }
  }

  const porSolicitud = new Map()
  for (const h of registros) {
    const lista = porSolicitud.get(h.solicitud) || []
    lista.push(historialALocal(h, firmadas[h.evidencia_url] || h.evidencia_url || ''))
    porSolicitud.set(h.solicitud, lista)
  }

  console.info(
    `[Supabase] descargadas ${filas.length} solicitud(es) y ${registros.length} registro(s) de historial`
    + (desde ? ' (incremental)' : ' (completo)')
  )
  return {
    solicitudes: filas.map((f) => aLocal(f, porSolicitud.get(f.codigo) || [])),
    conHistorial: new Set(codigos),
    watermark,
  }
}

// El camino de escritura de RLS rechaza la entrega del conductor con 42501 aun
// cuando las políticas la permiten; en ese caso se reintenta por el RPC
// SECURITY DEFINER `guardar_solicitud`, que autoriza en el servidor y escribe
// saltándose RLS (mismo patrón que `proximo_codigo`).
function esBloqueoRls(error) {
  return error?.code === '42501' || /row-level security/i.test(error?.message || '')
}

export async function empujarSolicitud(s) {
  if (!backendActivo || !s?.id) return false
  await preparar()

  const entradas = Array.isArray(s.historial) ? s.historial : []
  const filasHistorial = []
  for (const h of entradas) {
    let ruta = ''
    if (typeof h.evidencia === 'string' && h.evidencia.startsWith('data:')) {
      ruta = await subirEvidencia(s.id, h)
    } else if (typeof h.evidencia === 'string' && h.evidencia.startsWith('http')) {
      ruta = h.evidencia
    }
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
  const conId = filasHistorial.filter((f) => f.id)

  const { error } = await supabase
    .from('solicitudes')
    .upsert(fila, { onConflict: 'codigo' })

  if (error && esBloqueoRls(error)) {
    const { error: rpcError } = await supabase.rpc('guardar_solicitud', {
      p_fila: fila,
      p_historial: conId,
    })
    if (rpcError) throw rpcError
    console.info(
      `[Supabase] guardada ${s.id} vía RPC (RLS) · estado "${fila.estado}"`
      + ` · ${conId.length} registro(s) de historial`
    )
    return true
  }
  if (error) throw error

  if (conId.length > 0) {
    const { error: errorHist } = await supabase
      .from('historial')
      .upsert(conId, { onConflict: 'id' })
    if (errorHist) throw errorHist
  }
  console.info(
    `[Supabase] guardada ${s.codigo || s.id} · estado "${s.estado || 'Abierto'}"`
    + ` · ${conId.length} registro(s) de historial`
  )
  return true
}

export async function borrarSolicitud(codigo) {
  if (!backendActivo || !codigo) return false
  await preparar()
  const { error } = await supabase.from('solicitudes').delete().eq('codigo', codigo)
  if (error) throw error
  console.info(`[Supabase] borrada ${codigo}`)
  return true
}

export async function borrarTodasSolicitudes() {
  if (!backendActivo) return false
  await preparar()
  const { error } = await supabase.from('solicitudes').delete().neq('codigo', '')
  if (error) throw error
  console.info('[Supabase] borradas todas las solicitudes')
  return true
}

export async function cargarClientes() {
  if (!backendActivo) return null
  await iniciarSesion()
  const { data, error } = await supabase
    .from('clientes')
    .select('nit, nombre, bodega, zona')
    .order('nombre')
  if (error) {
    console.error('[Supabase] error cargando clientes:', error.message, error.details || '')
    throw error
  }
  console.info(`[Supabase] cargados ${data.length} cliente(s)`)
  return data.map((c) => ({ ...c, cliente: c.nombre }))
}

export async function cargarUsuarios() {
  if (!backendActivo) return null
  await iniciarSesion()
  const { data, error } = await supabase
    .from('usuarios')
    .select('correo, nombre, rol, vehiculo, placa, es_conductor')
    .eq('activo', true)
    .order('nombre')
  if (error) {
    console.error('[Supabase] error cargando usuarios:', error.message, error.details || '')
    throw error
  }
  console.info(`[Supabase] cargados ${data.length} usuario(s)`)
  return data
}

// Devuelve { correo, nombre, rol } del usuario autenticado actual, o null si no
// está registrado en la tabla usuarios. RLS limita la lectura a su propia fila.
export async function cargarUsuarioActual() {
  if (!backendActivo) return null
  await preparar()
  const { correo } = datosUsuario()
  if (!correo) return null
  const { data, error } = await supabase
    .from('usuarios')
    .select('correo, nombre, rol')
    .eq('correo', correo)
    .maybeSingle()
  if (error) {
    console.warn('[Supabase] no se pudo leer el rol del usuario actual:', error.message)
    return null
  }
  return data || null
}
