import { ESTADOS } from '../../Home/Components/estadoColors.js'

export const ESTADOS_FINALES = ['Entregado', 'Entregado Parcial']
export const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']

export const HEX_ESTADO = {
  'Abierto': '#EAB308',
  'Pendiente por Autorización': '#F97316',
  'Devolución a Solicitante': '#D946EF',
  'Retenido por Cartera': '#EF4444',
  'En Trámite': '#3B82F6',
  'En Tránsito': '#A855F7',
  'En Tránsito Parcial': '#D97706',
  'Entregado Parcial': '#EAB308',
  'Entregado': '#22C55E',
}

export function parseStamp(fecha, hora) {
  if (!fecha) return null
  const partes = String(fecha).split(/[/\-.]/)
  if (partes.length !== 3) return null
  const d = Number(partes[0])
  const m = Number(partes[1])
  let y = Number(partes[2])
  if (!d || !m || !y) return null
  if (y < 100) y = y >= 50 ? 1900 + y : 2000 + y

  let h = 0
  let mi = 0
  let s = 0
  const texto = String(hora || '').toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
  const match = texto.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/)
  if (match) {
    h = Number(match[1])
    mi = Number(match[2])
    s = Number(match[3] || 0)
    const ap = match[4]
    if (ap === 'pm' && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
  } else {
    const hh = texto.match(/(\d{1,2})\s*(?:h|horas?)/)
    if (hh) h = Number(hh[1]) % 24
  }

  const ts = new Date(y, m - 1, d, h, mi, s).getTime()
  return Number.isNaN(ts) ? null : ts
}

export function tiempoEntrega(solicitud) {
  const inicio = parseStamp(solicitud?.fechaSubida, solicitud?.horaSubida)
  if (!inicio) return null
  const historial = Array.isArray(solicitud?.historial) ? solicitud.historial : []
  const entrega = [...historial]
    .reverse()
    .find((h) => h?.campo === 'estado' && ESTADOS_FINALES.includes(h.nuevo))
  if (!entrega) return null
  const fin = parseStamp(entrega.fecha, entrega.hora)
  if (!fin) return null
  return {
    inicio,
    fin,
    horas: (fin - inicio) / 3600000,
    estado: entrega.nuevo,
    fechaHora: `${entrega.fecha || ''} ${entrega.hora || ''}`.trim(),
  }
}

export function formatHoras(horas) {
  if (!Number.isFinite(horas)) return '—'
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`
  const totalHoras = Math.round(horas)
  const dias = Math.floor(totalHoras / 24)
  const horasRestantes = totalHoras % 24
  if (dias === 0) return `${totalHoras} h`
  if (horasRestantes === 0) return `${dias} d`
  return `${dias} d ${horasRestantes} h`
}

export function resumen(solicitudes) {
  const porEstado = ESTADOS.map((estado) => ({
    estado,
    count: solicitudes.filter((s) => (s.estado || 'Abierto') === estado).length,
  })).filter((e) => e.count > 0)

  const enTransito = solicitudes.filter((s) => ESTADOS_TRANSITO.includes(s.estado || '')).length
  const entregados = solicitudes.filter((s) => ESTADOS_FINALES.includes(s.estado || '')).length
  const entregadosParcial = solicitudes.filter((s) => (s.estado || '') === 'Entregado Parcial').length
  const activos = solicitudes.length - entregados

  const horas = solicitudes
    .map((s) => tiempoEntrega(s)?.horas)
    .filter((h) => Number.isFinite(h))

  const promedio = horas.length ? horas.reduce((a, b) => a + b, 0) / horas.length : null
  const ordenadas = [...horas].sort((a, b) => a - b)
  const mediana = ordenadas.length
    ? ordenadas.length % 2
      ? ordenadas[Math.floor(ordenadas.length / 2)]
      : (ordenadas[ordenadas.length / 2 - 1] + ordenadas[ordenadas.length / 2]) / 2
    : null
  const max = ordenadas.length ? ordenadas[ordenadas.length - 1] : null

  return {
    total: solicitudes.length,
    activos,
    entregados,
    entregadosParcial,
    enTransito,
    pendientesSync: solicitudes.filter((s) => s.pendienteSync).length,
    porEstado,
    tiempos: {
      cantidad: horas.length,
      promedio,
      mediana,
      max,
    },
  }
}

export function porAsignado(solicitudes) {
  const mapa = new Map()
  for (const s of solicitudes) {
    const nombre = String(s.asignadoA || '').trim() || 'Sin asignar'
    const item = mapa.get(nombre) || { nombre, total: 0, activos: 0, entregados: 0 }
    item.total += 1
    if (ESTADOS_FINALES.includes(s.estado || '')) item.entregados += 1
    else item.activos += 1
    mapa.set(nombre, item)
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total)
}

export function histogramaTiempos(solicitudes) {
  const buckets = [
    { key: 'h6', max: 6, label: '< 6 h', color: '#22C55E' },
    { key: 'h12', max: 12, label: '6–12 h', color: '#84CC16' },
    { key: 'h24', max: 24, label: '12–24 h', color: '#EAB308' },
    { key: 'd2', max: 48, label: '1–2 d', color: '#F97316' },
    { key: 'd4', max: 96, label: '2–4 d', color: '#EF4444' },
    { key: 'resto', max: Infinity, label: '> 4 d', color: '#0A0027' },
  ]
  const conTiempo = solicitudes.map((s) => ({ s, t: tiempoEntrega(s) })).filter((x) => x.t)
  const conteo = buckets.map((b) => ({
    ...b,
    count: conTiempo.filter((x) => x.t.horas >= 0 && x.t.horas < b.max).length,
  }))

  const porNombre = new Map()
  for (const { s, t } of conTiempo) {
    const nombre = String(s.asignadoA || '').trim() || 'Sin asignar'
    const item = porNombre.get(nombre) || { nombre, totalHoras: 0, n: 0 }
    item.totalHoras += t.horas
    item.n += 1
    porNombre.set(nombre, item)
  }
  const promedioPorNombre = [...porNombre.values()]
    .map((x) => ({ nombre: x.nombre, promedio: x.totalHoras / x.n, n: x.n }))
    .sort((a, b) => b.promedio - a.promedio)

  const ultimasEntregas = conTiempo
    .map(({ s, t }) => ({
      id: s.id,
      cliente: s.cliente || '',
      zona: s.zona || '',
      estado: t.estado,
      horas: t.horas,
      fechaHora: t.fechaHora,
    }))
    .sort((a, b) => (a.fechaHora > b.fechaHora ? -1 : a.fechaHora < b.fechaHora ? 1 : 0))
    .slice(0, 8)

  return { buckets: conteo, promedioPorNombre, ultimasEntregas }
}

const NOMBRES_DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function contarPor(solicitudes, campo) {
  const mapa = new Map()
  for (const s of solicitudes) {
    const valor = String(s[campo] || '').trim() || 'Sin definir'
    const item = mapa.get(valor) || { nombre: valor, count: 0 }
    item.count += 1
    mapa.set(valor, item)
  }
  return [...mapa.values()].sort((a, b) => b.count - a.count)
}

export const porZona = (solicitudes) => contarPor(solicitudes, 'zona')

export const porTipo = (solicitudes) => contarPor(solicitudes, 'tipoSolicitud')

export const topClientes = (solicitudes, n = 8) => contarPor(solicitudes, 'cliente').slice(0, n)

export function porDiaSemana(solicitudes) {
  const semanas = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    dia: d,
    nombre: NOMBRES_DIA[d],
    count: 0,
  }))
  for (const s of solicitudes) {
    const ts = parseStamp(s.fechaSubida, s.horaSubida)
    if (!ts) continue
    semanas[new Date(ts).getDay()].count += 1
  }
  return semanas
}

const FRANJAS = [
  { key: 'madrugada', label: 'Madrugada', rango: '00–06', min: 0, max: 6, color: '#3B82F6' },
  { key: 'manana', label: 'Mañana', rango: '06–12', min: 6, max: 12, color: '#F97316' },
  { key: 'tarde', label: 'Tarde', rango: '12–18', min: 12, max: 18, color: '#EAB308' },
  { key: 'noche', label: 'Noche', rango: '18–24', min: 18, max: 24, color: '#071A3D' },
]

export function porFranja(solicitudes) {
  const out = FRANJAS.map((f) => ({ ...f, count: 0 }))
  for (const s of solicitudes) {
    const ts = parseStamp(s.fechaSubida, s.horaSubida)
    if (!ts) continue
    const h = new Date(ts).getHours()
    const f = out.find((x) => h >= x.min && h < x.max)
    if (f) f.count += 1
  }
  return out
}

export function seriesPorDia(solicitudes, dias = 14) {
  const hoy = new Date()
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const serie = []
  for (let i = dias - 1; i >= 0; i -= 1) {
    const dia = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i)
    const start = dia.getTime()
    const end = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + 1).getTime()
    let creadas = 0
    let entregadas = 0
    for (const s of solicitudes) {
      const ini = parseStamp(s.fechaSubida, s.horaSubida)
      if (ini && ini >= start && ini < end) creadas += 1
      const t = tiempoEntrega(s)
      if (t && t.fin && t.fin >= start && t.fin < end) entregadas += 1
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

export function tiempoPorEstado(solicitudes) {
  const mapa = new Map()
  for (const s of solicitudes) {
    const hist = (Array.isArray(s.historial) ? s.historial : [])
      .filter((h) => h?.campo === 'estado')
      .map((h) => ({
        ts: parseStamp(h.fecha, h.hora),
        anterior: h.anterior,
        nuevo: h.nuevo || h.anterior,
        id: h.id,
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
        id: s.id,
        cliente: s.cliente || '—',
        zona: s.zona || '—',
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

export function porConductor(solicitudes) {
  const mapa = new Map()
  for (const s of solicitudes) {
    const nombre = String(s.conductor || '').trim()
    if (!nombre || nombre === 'Otro') continue
    const item = mapa.get(nombre) || { nombre, total: 0, entregados: 0 }
    item.total += 1
    if (ESTADOS_FINALES.includes(s.estado || '')) item.entregados += 1
    mapa.set(nombre, item)
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total)
}

export function lentosActivos(solicitudes, umbralHoras = 48) {
  const ahora = Date.now()
  return solicitudes
    .filter((s) => !ESTADOS_FINALES.includes(s.estado || ''))
    .map((s) => {
      const inicio = parseStamp(s.fechaSubida, s.horaSubida) || ahora
      return {
        id: s.id,
        cliente: s.cliente || '',
        zona: s.zona || '',
        asignadoA: s.asignadoA || '',
        estado: s.estado || 'Abierto',
        horas: (ahora - inicio) / 3600000,
      }
    })
    .filter((x) => x.horas >= umbralHoras)
    .sort((a, b) => b.horas - a.horas)
    .slice(0, 8)
}