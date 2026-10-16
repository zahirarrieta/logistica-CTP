import { ESTADOS_RECOLECCION } from '../auth/roles.js'
import { parseStamp, formatHoras, HEX_ESTADO } from './dashboardUtils.js'
import { pdfsTramite } from './pdfUtils.js'

export { formatHoras, parseStamp }

// Estados del módulo de recolección (mismos que las solicitudes + «Fallido»).
export const ESTADOS_REC = ESTADOS_RECOLECCION

// Una recogida queda cerrada solo cuando se entrega o se cancela. «Fallido» NO
// cierra: se puede volver a tramitar, asignar conductor, etc.
export const ESTADOS_CERRADOS_REC = ['Entregado', 'Cancelado']
export const ESTADOS_TRANSITO_REC = ['En Tránsito']

// Colores de la pista (donut, leyendas). Reutiliza los de solicitudes y añade el
// vinotinto propio de «Fallido».
export const HEX_ESTADO_REC = { ...HEX_ESTADO, Fallido: '#7B1E2B' }

const NOMBRES_DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const FRANJAS = [
  { key: 'madrugada', label: 'Madrugada', rango: '00–06', min: 0, max: 6, color: '#3B82F6' },
  { key: 'manana', label: 'Mañana', rango: '06–12', min: 6, max: 12, color: '#F97316' },
  { key: 'tarde', label: 'Tarde', rango: '12–18', min: 12, max: 18, color: '#EAB308' },
  { key: 'noche', label: 'Noche', rango: '18–24', min: 18, max: 24, color: '#071A3D' },
]

const historialDe = (r) => (Array.isArray(r?.historial) ? r.historial : [])

// Guía de transporte que el administrador adjuntó al pasar la recogida por «En
// Trámite»: vive en el historial, igual que las facturas de una solicitud.
export const guiasRecoleccion = (r) => pdfsTramite(historialDe(r))

// Tiempo desde que se creó la recogida hasta que se marcó «Entregado».
export function tiempoEntregaRecoleccion(r) {
  const inicio = parseStamp(r?.fecha_subida, r?.hora_subida)
  if (!inicio) return null
  const entrega = [...historialDe(r)]
    .reverse()
    .find((h) => h?.campo === 'estado' && h.nuevo === 'Entregado')
  if (!entrega) return null
  const fin = parseStamp(entrega.fecha, entrega.hora)
  if (!fin) return null
  return {
    inicio,
    fin,
    horas: (fin - inicio) / 3600000,
    fechaHora: `${entrega.fecha || ''} ${entrega.hora || ''}`.trim(),
  }
}

function medianaDe(ordenadas) {
  if (!ordenadas.length) return null
  if (ordenadas.length % 2) return ordenadas[Math.floor(ordenadas.length / 2)]
  return (ordenadas[ordenadas.length / 2 - 1] + ordenadas[ordenadas.length / 2]) / 2
}

export function esActivaRec(r) {
  return !ESTADOS_CERRADOS_REC.includes(r?.estado || '')
}

export function resumenRecolecciones(recolecciones = []) {
  const porEstado = ESTADOS_REC.map((estado) => ({
    estado,
    count: recolecciones.filter((r) => (r.estado || 'Abierto') === estado).length,
  })).filter((e) => e.count > 0)

  const horas = recolecciones
    .map((r) => tiempoEntregaRecoleccion(r)?.horas)
    .filter((h) => Number.isFinite(h))
  const ordenadas = [...horas].sort((a, b) => a - b)

  return {
    total: recolecciones.length,
    activas: recolecciones.filter(esActivaRec).length,
    entregadas: recolecciones.filter((r) => (r.estado || '') === 'Entregado').length,
    canceladas: recolecciones.filter((r) => (r.estado || '') === 'Cancelado').length,
    fallidas: recolecciones.filter((r) => (r.estado || '') === 'Fallido').length,
    enTransito: recolecciones.filter((r) => ESTADOS_TRANSITO_REC.includes(r.estado || '')).length,
    enTramite: recolecciones.filter((r) => (r.estado || '') === 'En Trámite').length,
    enDevolucion: recolecciones.filter((r) => (r.estado || '') === 'Devolución a Solicitante').length,
    conGuia: recolecciones.filter((r) => pdfsTramite(historialDe(r)).length > 0).length,
    porEstado,
    tiempos: {
      cantidad: horas.length,
      promedio: horas.length ? horas.reduce((a, b) => a + b, 0) / horas.length : null,
      mediana: ordenadas.length ? medianaDe(ordenadas) : null,
      max: ordenadas.length ? ordenadas[ordenadas.length - 1] : null,
    },
  }
}

export function porAsignadoRec(recolecciones = []) {
  const mapa = new Map()
  for (const r of recolecciones) {
    const nombre = String(r.asignado_a || '').trim() || 'Sin asignar'
    const item = mapa.get(nombre) || { nombre, total: 0, activos: 0, entregados: 0 }
    item.total += 1
    if ((r.estado || '') === 'Entregado') item.entregados += 1
    else item.activos += 1
    mapa.set(nombre, item)
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total)
}

export function porConductorRec(recolecciones = []) {
  const mapa = new Map()
  for (const r of recolecciones) {
    const nombre = String(r.conductor || '').trim()
    if (!nombre || nombre === 'Otro') continue
    const item = mapa.get(nombre) || { nombre, total: 0, entregados: 0 }
    item.total += 1
    if ((r.estado || '') === 'Entregado') item.entregados += 1
    mapa.set(nombre, item)
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total)
}

function contarPor(recolecciones, campo) {
  const mapa = new Map()
  for (const r of recolecciones) {
    const valor = String(r[campo] || '').trim() || 'Sin definir'
    const item = mapa.get(valor) || { nombre: valor, count: 0 }
    item.count += 1
    mapa.set(valor, item)
  }
  return [...mapa.values()].sort((a, b) => b.count - a.count)
}

export const porZonaRec = (recolecciones) => contarPor(recolecciones, 'zona')

export const porTipoServicio = (recolecciones) => contarPor(recolecciones, 'tipo_servicio')

export const topClientesRec = (recolecciones, n = 8) =>
  contarPor(recolecciones, 'recoge_cliente').slice(0, n)

export function porDiaSemanaRec(recolecciones = []) {
  const dias = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dia: d, nombre: NOMBRES_DIA[d], count: 0 }))
  for (const r of recolecciones) {
    const ts = parseStamp(r.fecha_subida, r.hora_subida)
    if (!ts) continue
    dias[new Date(ts).getDay()].count += 1
  }
  return dias
}

export function porFranjaRec(recolecciones = []) {
  const out = FRANJAS.map((f) => ({ ...f, count: 0 }))
  for (const r of recolecciones) {
    const ts = parseStamp(r.fecha_subida, r.hora_subida)
    if (!ts) continue
    const h = new Date(ts).getHours()
    const f = out.find((x) => h >= x.min && h < x.max)
    if (f) f.count += 1
  }
  return out
}

export function seriesPorDiaRec(recolecciones = [], dias = 14) {
  const hoy = new Date()
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const serie = []
  for (let i = dias - 1; i >= 0; i -= 1) {
    const dia = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i)
    const start = dia.getTime()
    const end = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + 1).getTime()
    let creadas = 0
    let entregadas = 0
    for (const r of recolecciones) {
      const ini = parseStamp(r.fecha_subida, r.hora_subida)
      if (ini && ini >= start && ini < end) creadas += 1
      const t = tiempoEntregaRecoleccion(r)
      if (t && t.fin >= start && t.fin < end) entregadas += 1
    }
    serie.push({
      clave: dia.toLocaleDateString('es-CO'),
      nombre: `${NOMBRES_DIA[dia.getDay()].slice(0, 3)} ${dia.getDate()}`,
      creadas,
      entregadas,
    })
  }
  return serie
}

export function tiempoPorEstadoRec(recolecciones = []) {
  const mapa = new Map()
  for (const r of recolecciones) {
    const hist = historialDe(r)
      .filter((h) => h?.campo === 'estado')
      .map((h) => ({
        ts: parseStamp(h.fecha, h.hora),
        nuevo: h.nuevo || h.anterior,
        fecha: h.fecha,
        hora: h.hora,
      }))
      .filter((x) => x.ts)
      .sort((a, b) => a.ts - b.ts)
    for (let i = 0; i < hist.length - 1; i += 1) {
      const estado = hist[i].nuevo
      const delta = (hist[i + 1].ts - hist[i].ts) / 3600000
      if (!estado || delta < 0) continue
      const item = mapa.get(estado) || { estado, totalHoras: 0, n: 0, pedidos: [] }
      item.totalHoras += delta
      item.n += 1
      item.pedidos.push({
        id: r.codigo,
        cliente: r.recoge_cliente || '—',
        zona: r.zona || '—',
        horas: delta,
        entro: `${hist[i].fecha || ''} ${hist[i].hora || ''}`.trim(),
        salioHacia: hist[i + 1].nuevo,
      })
      mapa.set(estado, item)
    }
  }
  return [...mapa.values()]
    .map((x) => ({ estado: x.estado, promedio: x.totalHoras / x.n, n: x.n, pedidos: x.pedidos }))
    .sort((a, b) => b.promedio - a.promedio)
}

export function histogramaTiemposRec(recolecciones = []) {
  const buckets = [
    { key: 'h6', max: 6, label: '< 6 h', color: '#22C55E' },
    { key: 'h12', max: 12, label: '6–12 h', color: '#84CC16' },
    { key: 'h24', max: 24, label: '12–24 h', color: '#EAB308' },
    { key: 'd2', max: 48, label: '1–2 d', color: '#F97316' },
    { key: 'd4', max: 96, label: '2–4 d', color: '#EF4444' },
    { key: 'resto', max: Infinity, label: '> 4 d', color: '#0A0027' },
  ]
  const conTiempo = recolecciones.map((r) => ({ r, t: tiempoEntregaRecoleccion(r) })).filter((x) => x.t)
  const conteo = buckets.map((b) => ({
    ...b,
    count: conTiempo.filter((x) => x.t.horas >= 0 && x.t.horas < b.max).length,
  }))

  const porNombre = new Map()
  for (const { r, t } of conTiempo) {
    const nombre = String(r.asignado_a || '').trim() || 'Sin asignar'
    const item = porNombre.get(nombre) || { nombre, totalHoras: 0, n: 0 }
    item.totalHoras += t.horas
    item.n += 1
    porNombre.set(nombre, item)
  }
  const promedioPorNombre = [...porNombre.values()]
    .map((x) => ({ nombre: x.nombre, promedio: x.totalHoras / x.n, n: x.n }))
    .sort((a, b) => b.promedio - a.promedio)

  const ultimasEntregas = conTiempo
    .map(({ r, t }) => ({
      id: r.codigo,
      cliente: r.recoge_cliente || '',
      zona: r.zona || '',
      estado: r.estado || 'Entregado',
      horas: t.horas,
      fechaHora: `${t.fechaHora}`,
    }))
    .sort((a, b) => (a.fechaHora > b.fechaHora ? -1 : a.fechaHora < b.fechaHora ? 1 : 0))
    .slice(0, 10)

  return { buckets: conteo, promedioPorNombre, ultimasEntregas }
}

export function lentosActivosRec(recolecciones = [], umbralHoras = 48) {
  const ahora = Date.now()
  return recolecciones
    .filter(esActivaRec)
    .map((r) => {
      const inicio = parseStamp(r.fecha_subida, r.hora_subida) || ahora
      return {
        id: r.codigo,
        cliente: r.recoge_cliente || '',
        zona: r.zona || '',
        asignadoA: r.asignado_a || '',
        estado: r.estado || 'Abierto',
        horas: (ahora - inicio) / 3600000,
      }
    })
    .filter((x) => x.horas >= umbralHoras)
    .sort((a, b) => b.horas - a.horas)
}
