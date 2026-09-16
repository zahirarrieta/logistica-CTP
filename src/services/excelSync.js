import { buscarEntrega, loadSolicitudes, safeText } from '../pages/Home/Components/solicitudesStore.js'
import { excelConfigurado, upsertFila } from './excelGraph.js'

export const COLUMNAS = [
  'ID',
  'Fecha',
  'Hora',
  'Cliente',
  'NIT',
  'Zona',
  'Bodega',
  'Tipo de solicitud',
  'Solicitante',
  'Correo solicitante',
  'Observaciones',
  'Adjuntos',
  'Estado',
  'Asignado a',
  'Conductor',
  'Vehículo',
  'Placa',
  'Referencia / Remisión',
  'Observaciones de entrega',
  'Recibió',
  'Cargo',
  'Correo de contacto',
  'Fecha de entrega',
  'Hora de entrega',
  'Registró',
  'Evidencia',
  'Calificación',
  'Sincronizado',
]

function resumenEvidencia(valor) {
  const texto = safeText(valor)
  if (!texto) return ''
  if (texto.startsWith('data:application/pdf')) return 'PDF en la app'
  if (texto.startsWith('data:')) return 'Foto en la app'
  return texto
}

function filaDe(solicitud) {
  const entrega = buscarEntrega(solicitud)
  const encuesta = entrega?.encuesta && typeof entrega.encuesta === 'object' ? entrega.encuesta : null
  const ahora = new Date()
  return [
    safeText(solicitud.id),
    safeText(solicitud.fechaSubida),
    safeText(solicitud.horaSubida),
    safeText(solicitud.cliente),
    safeText(solicitud.nit),
    safeText(solicitud.zona),
    safeText(solicitud.bodega),
    safeText(solicitud.tipoSolicitud),
    safeText(solicitud.nombreCompleto),
    safeText(solicitud.correo),
    safeText(solicitud.observaciones),
    Array.isArray(solicitud.adjuntos) ? solicitud.adjuntos.join(', ') : safeText(solicitud.adjuntos),
    safeText(solicitud.estado),
    safeText(solicitud.asignadoA),
    safeText(solicitud.conductor) || safeText(entrega?.conductor),
    safeText(solicitud.vehiculo) || safeText(entrega?.vehiculo),
    safeText(solicitud.placa) || safeText(entrega?.placa),
    safeText(solicitud.numeroReferencia) || safeText(entrega?.referencia),
    safeText(entrega?.nota),
    safeText(encuesta?.nombreEncuestado),
    safeText(encuesta?.cargo),
    safeText(encuesta?.correo),
    safeText(entrega?.fecha),
    safeText(entrega?.hora),
    safeText(entrega?.persona),
    resumenEvidencia(entrega?.evidencia),
    encuesta?.promedio ? Number(encuesta.promedio).toFixed(1) : '',
    ahora.toLocaleString('es-CO'),
  ]
}

const COLA_KEY = 'ctp_excel_cola'
const INICIAL_KEY = 'ctp_excel_carga_inicial'

let procesando = false

function leerCola() {
  try {
    const cola = JSON.parse(localStorage.getItem(COLA_KEY) || '[]')
    return Array.isArray(cola) ? cola.filter((id) => typeof id === 'string' && id) : []
  } catch {
    return []
  }
}

function escribirCola(cola) {
  try {
    localStorage.setItem(COLA_KEY, JSON.stringify(cola))
  } catch {
    // ignorar
  }
}

function encolar(id) {
  if (!id) return
  const cola = leerCola()
  if (cola.includes(id)) return
  escribirCola([...cola, id])
}

function desencolar(id) {
  escribirCola(leerCola().filter((item) => item !== id))
}

export function excelActivo() {
  return excelConfigurado()
}

export function colaPendiente() {
  return leerCola().length
}

export async function procesarCola() {
  if (!excelConfigurado() || procesando || !navigator.onLine) return 0
  procesando = true
  let sincronizadas = 0
  try {
    for (;;) {
      const id = leerCola()[0]
      if (!id) break
      const solicitud = loadSolicitudes().find((s) => s.id === id)
      if (!solicitud) {
        desencolar(id)
        continue
      }
      try {
        await upsertFila(COLUMNAS, filaDe(solicitud))
      } catch (error) {
        console.warn('[Excel] sincronización pausada:', error.message)
        break
      }
      desencolar(id)
      sincronizadas += 1
    }
  } finally {
    procesando = false
  }
  return sincronizadas
}

export function registrarCambio(id) {
  if (!excelConfigurado()) return
  encolar(id)
  void procesarCola()
}

export function sincronizarTodo() {
  if (!excelConfigurado()) return Promise.resolve(0)
  for (const solicitud of loadSolicitudes()) encolar(solicitud.id)
  return procesarCola()
}

export function primeraCargaEnExcel() {
  if (!excelConfigurado() || localStorage.getItem(INICIAL_KEY)) return
  try {
    localStorage.setItem(INICIAL_KEY, new Date().toISOString())
  } catch {
    // ignorar
  }
  void sincronizarTodo()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void procesarCola()
  })
}
