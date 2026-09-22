import { msalInstance } from '../../../auth/msal.js'
import { shortName } from '../../../auth/user.js'
import { backendActivo } from '../../../services/supabaseClient.js'
import { descargarSolicitudes, empujarSolicitud, borrarSolicitud, borrarTodasSolicitudes } from '../../../services/solicitudesApi.js'
import { soloAdjuntosSolicitud } from '../../../components/pdfUtils.js'

const STORAGE_KEY = 'ctp_solicitudes'
const COUNTER_KEY = 'ctp_solicitudes_counter'
const WATERMARK_KEY = 'ctp_sync_watermark'

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']

export const ESTADOS_ENTREGA = ['Entregado', 'Entregado Parcial']

// Caché en memoria: evita re-parsear y re-normalizar todo el localStorage en
// cada llamada. Se invalida comparando el crudo guardado (detecta cambios de
// otras pestañas o escrituras externas).
let cache = null
let cacheRaw = null

function escribir(list) {
  let raw = null
  try {
    raw = JSON.stringify(list)
    localStorage.setItem(STORAGE_KEY, raw)
  } catch {
    // Si falla el almacenamiento (ej. cuota), se ignora
  }
  cache = list
  cacheRaw = raw
  return list
}

function generarId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function pendiente(id) {
  return escribir(loadSolicitudes().map((s) => (s.id === id ? { ...s, pendienteSync: true } : s)))
}

function empujar(solicitud) {
  if (!backendActivo || !solicitud?.id) return
  if (!navigator.onLine) {
    console.info(`[Supabase] sin conexión: ${solicitud.id} queda en la cola, se sube al volver la red`)
    pendiente(solicitud.id)
    return
  }
  const actual = loadSolicitudes().find((s) => s.id === solicitud.id) || solicitud
  void empujarSolicitud(actual)
    .then(() => {
      escribir(loadSolicitudes().map((s) => (s.id === actual.id ? { ...s, pendienteSync: false } : s)))
    })
    .catch((error) => {
      console.warn('[Supabase] no se pudo subir:', error)
      pendiente(actual.id)
    })
}

export function buscarEntrega(solicitud) {
  const historial = Array.isArray(solicitud?.historial) ? solicitud.historial : []
  return (
    [...historial]
      .reverse()
      .find((h) => h.campo === 'estado' && ESTADOS_ENTREGA.includes(h.nuevo)) || null
  )
}

// Devuelve la última entrada de historial que marcó la devolución al solicitante,
// para poder mostrar el motivo indicado por el administrador.
export function buscarDevolucion(solicitud) {
  const historial = Array.isArray(solicitud?.historial) ? solicitud.historial : []
  return (
    [...historial]
      .reverse()
      .find((h) => h.campo === 'estado' && h.nuevo === 'Devolución a Solicitante') || null
  )
}

function currentPersona() {
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0]
  return shortName(account)
}

function nextId() {
  let counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) || 0
  counter += 1
  try {
    localStorage.setItem(COUNTER_KEY, String(counter))
  } catch {
    // ignorar
  }
  return `CTPLOG-${String(counter).padStart(5, '0')}`
}

export function safeText(value) {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object') {
    const candidato = [
      value.asignadoA,
      value.nombre,
      value.name,
      value.nombreCompleto,
      value.label,
      value.usuario,
      value.correo,
    ].find((v) => typeof v === 'string' && v.trim())
    return candidato ? candidato.trim() : ''
  }
  return ''
}

export function nombreDeAsignado(value) {
  return safeText(value)
}

const TEXT_FIELDS = [
  'id',
  'fechaSubida',
  'horaSubida',
  'fecha',
  'hora',
  'nombreCompleto',
  'correo',
  'tipoSolicitud',
  'cliente',
  'bodega',
  'nit',
  'zona',
  'observaciones',
  'notaEstado',
  'numeroReferencia',
  'estado',
  'asignadoA',
  'asignadoCorreo',
  'conductor',
  'vehiculo',
  'placa',
  'evidencia',
]

export function loadSolicitudes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || ''
    if (cache && raw === cacheRaw) return cache
    const list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) {
      cache = []
      cacheRaw = raw
      return cache
    }
    let faltanIds = false
    const normalizada = list.map((s) => {
      if (!s || typeof s !== 'object') return {}
      const normal = { ...s }
      for (const key of TEXT_FIELDS) {
        if (typeof normal[key] !== 'string') normal[key] = safeText(normal[key])
      }
      normal.adjuntos = soloAdjuntosSolicitud(normal.adjuntos)
      if (Array.isArray(normal.historial)) {
        normal.historial = normal.historial.map((h) => {
          if (!h || typeof h !== 'object') return {}
          const hn = { ...h }
          if (typeof hn.id !== 'string' || !hn.id) {
            hn.id = generarId()
            faltanIds = true
          }
          if (typeof hn.anterior !== 'string') hn.anterior = safeText(hn.anterior)
          if (typeof hn.nuevo !== 'string') hn.nuevo = safeText(hn.nuevo)
          if (typeof hn.persona !== 'string') hn.persona = safeText(hn.persona)
          if (typeof hn.fecha !== 'string') hn.fecha = safeText(hn.fecha)
          if (typeof hn.hora !== 'string') hn.hora = safeText(hn.hora)
          if (typeof hn.nota !== 'string') hn.nota = safeText(hn.nota)
          if (typeof hn.referencia !== 'string') hn.referencia = safeText(hn.referencia)
          if (typeof hn.adjunto !== 'string') hn.adjunto = safeText(hn.adjunto)
          if (typeof hn.vehiculo !== 'string') hn.vehiculo = safeText(hn.vehiculo)
          if (typeof hn.placa !== 'string') hn.placa = safeText(hn.placa)
          if (typeof hn.conductor !== 'string') hn.conductor = safeText(hn.conductor)
          if (typeof hn.evidencia !== 'string') hn.evidencia = safeText(hn.evidencia)
          if (hn.encuesta && typeof hn.encuesta !== 'object') hn.encuesta = null
          return hn
        })
      }
      return normal
    })
    // Los id de historial se persisten para que la subida a Supabase no duplique filas.
    if (faltanIds) return escribir(normalizada)
    cache = normalizada
    cacheRaw = raw
    return cache
  } catch {
    return []
  }
}

function nowStamp() {
  const now = new Date()
  return {
    fecha: now.toLocaleDateString('es-CO'),
    hora: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

export function peekNextId() {
  const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) || 0
  return `CTPLOG-${String(counter + 1).padStart(5, '0')}`
}

export function saveSolicitud(data) {
  const list = loadSolicitudes()
  const now = new Date()
  const entry = {
    id: nextId(),
    fechaSubida: now.toLocaleDateString('es-CO'),
    horaSubida: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    estado: 'Abierto',
    asignadoA: '',
    asignadoCorreo: '',
    historial: [],
    ...data,
  }
  const next = escribir([entry, ...list])
  empujar(entry)
  return next
}

export function updateEstado(id, estado) {
  const next = escribir(loadSolicitudes().map((s) => (s.id === id ? { ...s, estado } : s)))
  empujar({ id })
  return next
}

export function updateSolicitud(id, updates) {
  const list = loadSolicitudes()
  const next = list.map((s) => {
    if (s.id !== id) return s
    const historial = Array.isArray(s.historial) ? s.historial : []
    const pdfUrls = Array.isArray(updates.nuevaFacturaUrls) ? updates.nuevaFacturaUrls : []
    const adjuntoTramite = Array.isArray(updates.adjuntosTramite) ? updates.adjuntosTramite.join(', ') : ''
    const campos = []
    if (updates.estado && updates.estado !== (s.estado || 'Abierto')) {
      const transito = ESTADOS_TRANSITO.includes(updates.estado)
      campos.push({
        campo: 'estado',
        anterior: s.estado || 'Abierto',
        nuevo: updates.estado,
        nota: updates.notaEstado || '',
        referencia: updates.numeroReferencia || s.numeroReferencia || '',
        adjunto: pdfUrls.length > 0 ? pdfUrls.join(', ') : adjuntoTramite,
        conductor: transito ? s.conductor || '' : '',
        vehiculo: transito ? s.vehiculo || '' : '',
        placa: transito ? s.placa || '' : '',
        evidencia: updates.evidencia || '',
        encuesta: updates.encuesta || null,
      })
    }
    if ('asignadoA' in updates && updates.asignadoA !== (s.asignadoA || '')) {
      campos.push({ campo: 'asignado', anterior: s.asignadoA || 'Sin asignar', nuevo: updates.asignadoA || 'Sin asignar' })
    }
    if ('conductor' in updates && (updates.conductor || '') !== (s.conductor || '')) {
      campos.push({
        campo: 'conductor',
        anterior: s.conductor || 'Sin asignar',
        nuevo: updates.conductor || 'Sin asignar',
        vehiculo: updates.vehiculo || '',
        placa: updates.placa || '',
      })
    }
    const adicionales = { ...updates }
    delete adicionales.nuevaFacturaUrls
    delete adicionales.adjuntosTramite

    let historialFinal = historial
    if (campos.length === 0 && pdfUrls.length > 0) {
      // Sin cambio de estado: se actualiza el adjunto del trámite en el historial
      historialFinal = [...historial]
      const idx = historialFinal.findIndex((h) => h.campo === 'estado' && h.nuevo === 'En Trámite')
      if (idx >= 0) {
        historialFinal[idx] = { ...historialFinal[idx], adjunto: pdfUrls.join(', ') }
      } else {
        const { fecha, hora } = nowStamp()
        historialFinal = [
          {
            id: generarId(),
            campo: 'estado',
            anterior: s.estado || 'Abierto',
            nuevo: s.estado || 'Abierto',
            nota: '',
            referencia: updates.numeroReferencia || s.numeroReferencia || '',
            adjunto: pdfUrls.join(', '),
            persona: currentPersona(),
            fecha,
            hora,
          },
          ...historialFinal,
        ].slice(0, 30)
      }
    }

    if (campos.length === 0) return { ...s, ...adicionales, historial: historialFinal }
    const { fecha, hora } = nowStamp()
    const nuevos = campos.map((c) => ({ ...c, id: generarId(), fecha, hora, persona: currentPersona() }))
    return { ...s, ...adicionales, historial: [...nuevos, ...historialFinal].slice(0, 30) }
  })
  escribir(next)
  empujar({ id })
  return next
}

// Corrección tras una devolución: actualiza los campos editables, devuelve la
// solicitud a estado 'Abierto' y deja constancia en el historial.
export function corregirSolicitud(id, datos) {
  return updateSolicitud(id, {
    ...datos,
    estado: 'Abierto',
    notaEstado: 'SOLICITUD CORREGIDA Y REENVIADA POR EL SOLICITANTE',
  })
}

export function removeSolicitud(id) {
  const next = escribir(loadSolicitudes().filter((s) => s.id !== id))
  if (backendActivo) void borrarSolicitud(id).catch((error) => console.warn('[Supabase] no se pudo borrar en la base:', error))
  return next
}

export function clearSolicitudes() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(COUNTER_KEY)
    localStorage.removeItem(WATERMARK_KEY)
  } catch {
    // ignorar
  }
  cache = []
  cacheRaw = ''
  return cache
}

// Borra todo (local y, si hay backend, en Supabase) y reinicia el contador.
// Pensado para pruebas: el siguiente pedido vuelve a CTPLOG-00001.
export async function resetSolicitudes() {
  if (backendActivo) {
    try {
      await borrarTodasSolicitudes()
    } catch (error) {
      console.warn('[Supabase] no se pudo limpiar en la base, se limpiará solo local:', error)
    }
  }
  return clearSolicitudes()
}

const BORRADOR_KEY = 'ctp_entrega_borrador_'

export function guardarBorradorEntrega(id, datos) {
  try {
    localStorage.setItem(BORRADOR_KEY + id, JSON.stringify({ ...datos, guardadoEn: Date.now() }))
  } catch {
    // ignorar
  }
}

export function cargarBorradorEntrega(id) {
  try {
    const raw = localStorage.getItem(BORRADOR_KEY + id)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function eliminarBorradorEntrega(id) {
  try {
    localStorage.removeItem(BORRADOR_KEY + id)
  } catch {
    // ignorar
  }
}

export function marcarPendienteSync(id) {
  return pendiente(id)
}

export async function sincronizarPendientes() {
  if (!backendActivo) return 0
  const pendientes = loadSolicitudes().filter((s) => s.pendienteSync)
  if (pendientes.length === 0) return 0
  let subidas = 0
  for (const s of pendientes) {
    try {
      await empujarSolicitud(s)
      subidas += 1
      escribir(loadSolicitudes().map((x) => (x.id === s.id ? { ...x, pendienteSync: false } : x)))
    } catch (error) {
      console.warn('[Supabase] pendientes en pausa:', error)
      break
    }
  }
  return subidas
}

function numeroDe(id) {
  const n = parseInt(String(id).replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

function sembrarContador(list) {
  const maximo = list.reduce((acc, s) => Math.max(acc, numeroDe(s.id)), 0)
  if (maximo <= 0) return
  const actual = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) || 0
  if (maximo > actual) {
    try {
      localStorage.setItem(COUNTER_KEY, String(maximo))
    } catch {
      // ignorar
    }
  }
}

function leerWatermark() {
  try {
    return localStorage.getItem(WATERMARK_KEY) || ''
  } catch {
    return ''
  }
}

function guardarWatermark(valor) {
  if (!valor) return
  try {
    localStorage.setItem(WATERMARK_KEY, valor)
  } catch {
    // ignorar
  }
}

// Trae desde Supabase y lo fusiona con la caché local. Solo re-descarga el
// historial de las solicitudes que cambiaron desde la última sincronización
// (marca de agua); el resto conserva su historial local. Lo que esté marcado
// como pendiente de sincronizar gana sobre lo remoto (se hizo sin conexión).
export async function sincronizarInicial() {
  const locales = loadSolicitudes()
  if (!backendActivo || !navigator.onLine) return locales

  let resultado
  try {
    resultado = await descargarSolicitudes(leerWatermark())
  } catch (error) {
    console.warn('[Supabase] sin datos remotos:', error)
    return locales
  }
  if (!resultado || !Array.isArray(resultado.solicitudes)) return locales

  const { solicitudes: remotas, conHistorial, watermark } = resultado
  const porIdLocal = new Map(locales.map((s) => [s.id, s]))
  const idsRemotos = new Set(remotas.map((r) => r.id))

  const fusion = []
  for (const remota of remotas) {
    const local = porIdLocal.get(remota.id)
    if (local?.pendienteSync) {
      fusion.push(local)
    } else if (local && !conHistorial.has(remota.id)) {
      fusion.push({ ...remota, historial: local.historial })
    } else {
      fusion.push(remota)
    }
  }
  // Los locales pendientes que ya no existen en remoto se conservan (aún sin subir).
  for (const local of locales) {
    if (local.pendienteSync && !idsRemotos.has(local.id)) fusion.push(local)
  }

  escribir(fusion)
  guardarWatermark(watermark)
  sembrarContador(fusion)
  void sincronizarPendientes()
  return fusion
}
