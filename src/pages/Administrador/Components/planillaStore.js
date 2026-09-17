const STORAGE_KEY = 'ctp_planillas'

const VACIA = {
  conductor: '',
  vehiculo: '',
  placa: '',
  fecha: '',
  observaciones: '',
  filasOcultas: [],
  filasAgregadas: [],
  filasExtra: [],
  observacionesFila: {},
}

export function claveConductor(nombre) {
  return String(nombre || '').trim().toLowerCase()
}

export function fechaHoy() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function nuevaClaveFila() {
  return `fila-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function loadPlanillas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || ''
    const data = raw ? JSON.parse(raw) : {}
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function guardarTodo(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // sin espacio o modo privado: se ignora
  }
  return data
}

export function getPlanilla(conductor) {
  const clave = claveConductor(conductor)
  const guardada = loadPlanillas()[clave]
  return { ...VACIA, ...guardada, conductor }
}

export function guardarPlanilla(conductor, patch) {
  const clave = claveConductor(conductor)
  if (!clave) return
  const data = loadPlanillas()
  const actual = { ...VACIA, ...(data[clave] || {}), conductor }
  data[clave] = { ...actual, ...patch, conductor }
  guardarTodo(data)
}

export function resetPlanilla(conductor) {
  const clave = claveConductor(conductor)
  if (!clave) return getPlanilla(conductor)
  const data = loadPlanillas()
  delete data[clave]
  guardarTodo(data)
  return getPlanilla(conductor)
}
