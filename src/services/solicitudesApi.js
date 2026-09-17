import { supabase, iniciarSesion, datosUsuario, backendActivo } from './supabaseClient.js'

const EXPIRA_EVIDENCIA = 60 * 60 * 24 // 24 h

let usuarioRegistrado = false

async function preparar() {
  await iniciarSesion()
  if (usuarioRegistrado) return
  const { correo, nombre } = datosUsuario()
  if (!correo) return
  usuarioRegistrado = true
  try {
    await supabase.from('usuarios').insert({ correo, nombre }, { ignoreDuplicates: true })
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
    adjuntos: Array.isArray(s.adjuntos) ? s.adjuntos.filter((a) => typeof a === 'string') : [],
    solicitante_nombre: s.nombreCompleto || '',
    solicitante_correo: (s.correo || '').toLowerCase(),
    estado: s.estado || 'Abierto',
    asignado_a: s.asignadoA || '',
    conductor: s.conductor || '',
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
    adjuntos: fila.adjuntos || [],
    estado: fila.estado,
    asignadoA: fila.asignado_a,
    conductor: fila.conductor,
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

export async function descargarSolicitudes() {
  if (!backendActivo) return null
  await preparar()

  const { data: filas, error } = await supabase
    .from('solicitudes')
    .select('*')
    .order('actualizado_en', { ascending: false })
    .limit(1000)
  if (error) throw error

  const codigos = filas.map((f) => f.codigo)
  let registros = []
  if (codigos.length > 0) {
    const { data, error: errorHist } = await supabase
      .from('historial')
      .select('*')
      .in('solicitud', codigos)
      .order('creado_en', { ascending: false })
    if (errorHist) throw errorHist
    registros = data || []
  }

  const rutas = [...new Set(registros.map((h) => h.evidencia_url).filter(Boolean))]
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
  )
  return filas.map((f) => aLocal(f, porSolicitud.get(f.codigo) || []))
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

  const { error } = await supabase
    .from('solicitudes')
    .upsert(filaDe(s), { onConflict: 'codigo' })
  if (error) throw error

  const conId = filasHistorial.filter((f) => f.id)
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
    .select('correo, nombre, rol')
    .eq('activo', true)
    .order('nombre')
  if (error) {
    console.error('[Supabase] error cargando usuarios:', error.message, error.details || '')
    throw error
  }
  console.info(`[Supabase] cargados ${data.length} usuario(s)`)
  return data
}
