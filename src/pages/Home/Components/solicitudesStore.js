import { msalInstance } from '../../../auth/msal.js'
import { shortName } from '../../../auth/user.js'
import { backendActivo } from '../../../services/supabaseClient.js'
import { descargarSolicitudes, empujarSolicitud, borrarSolicitud } from '../../../services/solicitudesApi.js'

const STORAGE_KEY = 'ctp_solicitudes'
const COUNTER_KEY = 'ctp_solicitudes_counter'

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']

export const ESTADOS_ENTREGA = ['Entregado', 'Entregado Parcial']

function escribir(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Si falla el almacenamiento (ej. cuota), se ignora
  }
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
  'conductor',
  'vehiculo',
  'placa',
  'evidencia',
]

export function loadSolicitudes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    let faltanIds = false
    const normalizada = list.map((s) => {
      if (!s || typeof s !== 'object') return {}
      const normal = { ...s }
      for (const key of TEXT_FIELDS) {
        if (typeof normal[key] !== 'string') normal[key] = safeText(normal[key])
      }
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
    if (faltanIds) escribir(normalizada)
    return normalizada
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
    const campos = []
    if (updates.estado && updates.estado !== (s.estado || 'Abierto')) {
      const transito = ESTADOS_TRANSITO.includes(updates.estado)
      campos.push({
        campo: 'estado',
        anterior: s.estado || 'Abierto',
        nuevo: updates.estado,
        nota: updates.notaEstado || '',
        referencia: updates.numeroReferencia || '',
        adjunto: Array.isArray(updates.adjuntosTramite) ? updates.adjuntosTramite.join(', ') : '',
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
    if (campos.length === 0) return { ...s, ...updates, historial }
    const { fecha, hora } = nowStamp()
    const nuevos = campos.map((c) => ({ ...c, id: generarId(), fecha, hora, persona: currentPersona() }))
    return { ...s, ...updates, historial: [...nuevos, ...historial].slice(0, 30) }
  })
  escribir(next)
  empujar({ id })
  return next
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
  } catch {
    // ignorar
  }
  return []
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

// Trae todo desde Supabase y lo fusiona con la caché local. Lo que esté marcado
// como pendiente de sincronizar gana sobre lo remoto (se hizo sin conexión).
export async function sincronizarInicial() {
  const locales = loadSolicitudes()
  if (!backendActivo || !navigator.onLine) return locales

  let remotas
  try {
    remotas = await descargarSolicitudes()
  } catch (error) {
    console.warn('[Supabase] sin datos remotos:', error)
    return locales
  }
  if (!Array.isArray(remotas)) return locales

  const porId = new Map(remotas.map((r) => [r.id, r]))
  const fusion = []
  for (const local of locales) {
    const remota = porId.get(local.id)
    porId.delete(local.id)
    fusion.push(!remota || local.pendienteSync ? local : remota)
  }
  for (const remota of porId.values()) fusion.push(remota)

  escribir(fusion)
  sembrarContador(fusion)
  void sincronizarPendientes()
  return fusion
}
