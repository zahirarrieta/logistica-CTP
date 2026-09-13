import { msalInstance } from '../../../auth/msal.js'
import { shortName } from '../../../auth/user.js'

const STORAGE_KEY = 'ctp_solicitudes'
const COUNTER_KEY = 'ctp_solicitudes_counter'

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
]

export function loadSolicitudes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return list.map((s) => {
      if (!s || typeof s !== 'object') return {}
      const normal = { ...s }
      for (const key of TEXT_FIELDS) {
        if (typeof normal[key] !== 'string') normal[key] = safeText(normal[key])
      }
      if (Array.isArray(normal.historial)) {
        normal.historial = normal.historial.map((h) => {
          if (!h || typeof h !== 'object') return {}
          const hn = { ...h }
          if (typeof hn.anterior !== 'string') hn.anterior = safeText(hn.anterior)
          if (typeof hn.nuevo !== 'string') hn.nuevo = safeText(hn.nuevo)
          if (typeof hn.persona !== 'string') hn.persona = safeText(hn.persona)
          if (typeof hn.fecha !== 'string') hn.fecha = safeText(hn.fecha)
          if (typeof hn.hora !== 'string') hn.hora = safeText(hn.hora)
          if (typeof hn.nota !== 'string') hn.nota = safeText(hn.nota)
          if (typeof hn.referencia !== 'string') hn.referencia = safeText(hn.referencia)
          if (typeof hn.adjunto !== 'string') hn.adjunto = safeText(hn.adjunto)
          return hn
        })
      }
      return normal
    })
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
  const next = [entry, ...list]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Si falla el almacenamiento (ej. cuota), se ignora
  }
  return next
}

export function updateEstado(id, estado) {
  const next = loadSolicitudes().map((s) => (s.id === id ? { ...s, estado } : s))
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignorar
  }
  return next
}

export function updateSolicitud(id, updates) {
  const list = loadSolicitudes()
  const next = list.map((s) => {
    if (s.id !== id) return s
    const historial = Array.isArray(s.historial) ? s.historial : []
    const campos = []
    if (updates.estado && updates.estado !== (s.estado || 'Abierto')) {
      campos.push({
        campo: 'estado',
        anterior: s.estado || 'Abierto',
        nuevo: updates.estado,
        nota: updates.notaEstado || '',
        referencia: updates.numeroReferencia || '',
        adjunto: Array.isArray(updates.adjuntosTramite) ? updates.adjuntosTramite.join(', ') : '',
      })
    }
    if ('asignadoA' in updates && updates.asignadoA !== (s.asignadoA || '')) {
      campos.push({ campo: 'asignado', anterior: s.asignadoA || 'Sin asignar', nuevo: updates.asignadoA || 'Sin asignar' })
    }
    if (campos.length === 0) return { ...s, ...updates, historial }
    const { fecha, hora } = nowStamp()
    const nuevos = campos.map((c) => ({ ...c, fecha, hora, persona: currentPersona() }))
    return { ...s, ...updates, historial: [...nuevos, ...historial].slice(0, 30) }
  })
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignorar
  }
  return next
}

export function removeSolicitud(id) {
  const next = loadSolicitudes().filter((s) => s.id !== id)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignorar
  }
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
