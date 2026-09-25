import { useMemo, useRef, useState } from 'react'
import {
  MdInsights,
  MdInbox,
  MdCheckCircle,
  MdSchedule,
  MdAccessTime,
  MdLocalShipping,
  MdAssignmentInd,
  MdBarChart,
  MdDonutLarge,
  MdTimeline,
  MdPendingActions,
  MdLocationPin,
  MdCategory,
  MdToday,
  MdBusiness,
  MdWarning,
  MdHourglassEmpty,
  MdTrendingUp,
  MdPictureAsPdf,
  MdTableChart,
  MdList,
  MdChevronRight,
  MdStar,
  MdStarHalf,
  MdThumbUp,
  MdPoll,
} from 'react-icons/md'
import StarRating from '../../../components/StarRating.jsx'
import {
  resumen,
  porAsignado,
  histogramaTiempos,
  porZona,
  porTipo,
  porDiaSemana,
  porFranja,
  seriesPorDia,
  tiempoPorEstado,
  porConductor,
  topClientes,
  lentosActivos,
  resumenEncuestas,
  promedioPorConductorEncuesta,
  topClientesSatisfaccion,
  promedioDeEncuesta,
  nivelEstrella,
  formatHoras,
  HEX_ESTADO,
} from './dashboardUtils.js'
import { getBadgeColor } from '../../Home/Components/estadoColors.js'
import { nombreDeAsignado } from '../../Home/Components/solicitudesStore.js'
import PedidoDetalleModal from './modals/PedidoDetalleModal.jsx'
import EtapaPedidosModal from './modals/EtapaPedidosModal.jsx'
import PedidosListaModal from './modals/PedidosListaModal.jsx'
import { exportarExcel, exportarPdf } from './exportarInforme.js'

const CARD_ICON = 'grid place-items-center size-10 rounded-xl text-white text-xl shadow-md'

export function Kpi({ icon, label, value, accent, sub }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-brand-ink/10 shadow-sm p-4 flex items-center gap-3.5">
      <span className={`${CARD_ICON} ${accent}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-2xl font-extrabold text-brand-ink leading-none truncate">{value}</span>
        <span className="block text-[11px] font-bold text-brand-ink/50 uppercase tracking-wide mt-1 truncate">{label}</span>
        {sub && <span className="block text-[11px] font-semibold text-brand-ink/40 mt-0.5 truncate">{sub}</span>}
      </span>
    </div>
  )
}

export function Seccion({ icon, titulo, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-white ring-1 ring-brand-ink/10 shadow-sm p-5 sm:p-6 ${className}`}>
      <h2 className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-brand-deep mb-5">
        <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/30">
          {icon}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  )
}

export function Donut({ porEstado, total }) {
  const R = 56
  const C = 2 * Math.PI * R
  let acumulado = 0
  return (
    <div className="flex flex-col items-center justify-center gap-6 pt-2 sm:flex-row sm:items-center sm:justify-center sm:gap-12 sm:pt-5">
      <div className="relative shrink-0 animate-fadeIn">
        <svg viewBox="0 0 140 140" className="w-56 h-56 sm:w-64 sm:h-64 drop-shadow-sm">
          <circle cx="70" cy="70" r={R} fill="none" stroke="#EAF4F7" strokeWidth="16" />
          {porEstado.map(({ estado, count }) => {
            const frac = total ? count / total : 0
            const len = Math.max(frac * C - 1.5, 0.4)
            const inicio = acumulado
            acumulado += frac
            return (
              <circle
                key={estado}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={HEX_ESTADO[estado] || '#94A3B8'}
                strokeWidth="16"
                strokeLinecap="butt"
                strokeDasharray={`${len} ${C}`}
                strokeDashoffset={-inicio * C}
                transform="rotate(-90 70 70)"
              >
                <title>{`${estado}: ${count} pedidos`}</title>
              </circle>
            )
          })}
          <text x="70" y="66" textAnchor="middle" className="fill-brand-ink" fontSize="22" fontWeight="800">
            {total}
          </text>
          <text x="70" y="84" textAnchor="middle" className="fill-brand-ink/40" fontSize="9" fontWeight="700">
            PEDIDOS
          </text>
        </svg>
      </div>
      <div className="w-full min-w-0 space-y-1.5">
        {porEstado.length === 0 ? (
          <p className="text-sm text-brand-ink/50">Sin datos por estado</p>
        ) : (
          porEstado.map(({ estado, count }) => {
            const pct = total ? Math.round((count / total) * 100) : 0
            return (
              <div key={estado} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: HEX_ESTADO[estado] || '#94A3B8' }} />
                <span className="truncate font-semibold text-brand-deep">{estado}</span>
                <span className="ml-auto shrink-0 font-extrabold text-brand-ink tabular-nums">{count}</span>
                <span className="w-10 shrink-0 text-right text-xs font-bold text-brand-ink/40 tabular-nums">{pct}%</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function BarrasAsignado({ items, onClick, hint }) {
  const max = Math.max(1, ...items.map((i) => i.total))
  return (
    <div className="space-y-2.5">
      {items.length === 0 && <p className="text-sm text-brand-ink/50">Sin asignaciones</p>}
      {items.map((i) => {
        const fila = (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-bold text-brand-deep">{i.nombre}</span>
              <span className="shrink-0 font-extrabold text-brand-ink tabular-nums">
                {i.total} <span className="text-[10px] font-bold text-brand-ink/40">PEDIDOS</span>
              </span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-brand-mist ring-1 ring-brand-ink/5">
              <span
                className="db-bar-anim h-full rounded-l-full bg-gradient-to-r from-brand-deep to-brand-cyan"
                style={{ width: `${(i.activos / max) * 100}%` }}
                title={`${i.activos} activos`}
              />
              <span
                className="db-bar-anim h-full rounded-r-full bg-green-500"
                style={{ width: `${(i.entregados / max) * 100}%` }}
                title={`${i.entregados} entregados`}
              />
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-brand-ink/50">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-brand-cyan" /> {i.activos} activos
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-green-500" /> {i.entregados} entregados
              </span>
            </div>
          </div>
        )
        return onClick ? (
          <button
            key={i.nombre}
            type="button"
            onClick={() => onClick(i)}
            title={hint || `Ver los pedidos de ${i.nombre}`}
            className="w-full rounded-xl px-2 py-1.5 -mx-2 text-left transition-colors hover:bg-brand-cyan/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60"
          >
            {fila}
          </button>
        ) : (
          <div key={i.nombre}>{fila}</div>
        )
      })}
    </div>
  )
}

export function BarrasH({ items, colorHex, formato, onClick, hint }) {
  const max = Math.max(1, ...items.map((i) => i.valor))
  if (items.length === 0) return <p className="text-sm text-brand-ink/50">Sin datos</p>
  return (
    <div className="space-y-2.5">
      {items.map((i) => {
        const barras = (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-bold text-brand-deep">{i.nombre}</span>
              <span className="shrink-0 whitespace-nowrap text-xs font-extrabold text-brand-ink tabular-nums">
                {formato ? formato(i) : i.valor}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-brand-mist ring-1 ring-brand-ink/5">
              <span
                className={`db-bar-anim block h-full rounded-full ${colorHex ? '' : 'bg-gradient-to-r from-brand-deep to-brand-cyan'}`}
                style={colorHex ? { width: `${(i.valor / max) * 100}%`, backgroundColor: colorHex } : { width: `${(i.valor / max) * 100}%` }}
              />
            </div>
          </div>
        )
        return onClick ? (
          <button
            key={i.nombre}
            type="button"
            onClick={() => onClick(i)}
            title={hint || 'Ver pedidos de esta etapa'}
            className="w-full rounded-xl px-2 py-1.5 -mx-2 text-left transition-colors hover:bg-brand-cyan/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60"
          >
            {barras}
          </button>
        ) : (
          <div key={i.nombre}>{barras}</div>
        )
      })}
    </div>
  )
}

export function Histograma({ items }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div className="flex items-end justify-between gap-2 sm:gap-3 h-40">
      {items.map((b, idx) => {
        const alto = Math.max(6, Math.round((b.count / max) * 100))
        return (
          <div key={b.key || idx} className="flex flex-1 flex-col items-center justify-end gap-1.5 h-full">
            <span className="text-xs font-extrabold text-brand-ink tabular-nums">{b.count}</span>
            <div
              className="db-bar-anim-v w-full rounded-t-lg transition-all"
              style={{ height: `${alto}%`, backgroundColor: b.color }}
              title={`${b.label}: ${b.count}`}
            />
            <span className="text-[10px] font-bold text-brand-ink/50 whitespace-nowrap">{b.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function BarrasActividad({ serie }) {
  const max = Math.max(1, ...serie.flatMap((d) => [d.creadas, d.entregadas]))
  return (
    <div className="flex items-end justify-between gap-1.5 sm:gap-2 h-40">
      {serie.map((d) => (
        <div key={d.clave} className="flex flex-1 flex-col items-center justify-end gap-1 h-full">
          <div className="flex items-end gap-[3px] w-full h-28">
            <span
              className="db-bar-anim-v flex-1 rounded-t-md bg-gradient-to-t from-brand-deep to-brand-cyan"
              style={{ height: `${Math.max(3, (d.creadas / max) * 100)}%` }}
              title={`${d.creadas} creadas · ${d.clave}`}
            />
            <span
              className="db-bar-anim-v flex-1 rounded-t-md bg-green-500"
              style={{ height: `${Math.max(3, (d.entregadas / max) * 100)}%` }}
              title={`${d.entregadas} entregadas · ${d.clave}`}
            />
          </div>
          <span className="text-[9px] font-bold text-brand-ink/50 whitespace-nowrap">{d.nombre}</span>
        </div>
      ))}
    </div>
  )
}

const ESTRELLA_BAR = { 1: 'bg-red-500', 2: 'bg-amber-500', 3: 'bg-green-500' }

export function DistribucionEstrellas({ items, total, onClick, hint }) {
  if (items.length === 0) return <p className="text-sm text-brand-ink/50">Sin datos</p>
  return (
    <div className="space-y-2.5">
      {items.map((s) => {
        const pct = total ? Math.round((s.count / total) * 100) : 0
        const fila = (
          <div className="flex items-center gap-2.5">
            <span className="w-9 shrink-0">
              <StarRating value={s.estrellas} max={3} disabled compact />
            </span>
            <span className="w-20 truncate text-sm font-bold text-brand-deep">{s.nombre}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-mist ring-1 ring-brand-ink/5">
              <span
                className={`db-bar-anim block h-full rounded-full ${ESTRELLA_BAR[s.estrellas]}`}
                style={{ width: `${pct}%` }}
                title={`${s.count} respuestas (${pct}%)`}
              />
            </div>
            <span className="shrink-0 w-9 text-right font-extrabold text-brand-ink tabular-nums">{s.count}</span>
            <span className="shrink-0 w-10 text-right text-xs font-bold text-brand-ink/40 tabular-nums">{pct}%</span>
          </div>
        )
        return onClick ? (
          <button
            key={s.estrellas}
            type="button"
            onClick={() => onClick(s)}
            title={hint || `Ver entregas con respuesta de ${s.estrellas}${s.estrellas === 1 ? ' estrella' : ' estrellas'}`}
            className="w-full rounded-xl px-2 py-1.5 -mx-2 text-left transition-colors hover:bg-brand-cyan/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60"
          >
            {fila}
          </button>
        ) : (
          <div key={s.estrellas}>{fila}</div>
        )
      })}
    </div>
  )
}

export function SatisfaccionLista({ items, onClick, hint }) {
  const max = Math.max(1, ...items.map((i) => i.valor))
  if (items.length === 0) return <p className="text-sm text-brand-ink/50">Sin encuestas</p>
  return (
    <div className="space-y-2.5">
      {items.map((i) => {
        const fila = (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-bold text-brand-deep">{i.nombre}</span>
              <span className="shrink-0 font-extrabold text-brand-ink tabular-nums">{i.valor.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-2">
              <StarRating value={Math.round(i.valor)} max={3} disabled compact />
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-mist ring-1 ring-brand-ink/5">
                <span
                  className="db-bar-anim block h-full rounded-full bg-gradient-to-r from-brand-deep to-brand-cyan"
                  style={{ width: `${(i.valor / max) * 100}%` }}
                />
              </div>
              <span className="shrink-0 text-[10px] font-bold text-brand-ink/40 tabular-nums">
                {i.votos} votos
              </span>
            </div>
          </div>
        )
        return onClick ? (
          <button
            key={i.nombre}
            type="button"
            onClick={() => onClick(i)}
            title={hint || `Ver entregas de ${i.nombre}`}
            className="w-full rounded-xl px-2 py-1.5 -mx-2 text-left transition-colors hover:bg-brand-cyan/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60"
          >
            {fila}
          </button>
        ) : (
          <div key={i.nombre}>{fila}</div>
        )
      })}
    </div>
  )
}

export function EstadoMargen() {
  return (
    <div className="flex items-center gap-4 text-[11px] font-bold text-brand-ink/50">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-gradient-to-t from-brand-deep to-brand-cyan" /> Creadas
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-green-500" /> Entregadas
      </span>
    </div>
  )
}

export default function DashboardTab({ solicitudes }) {
  const informeRef = useRef(null)
  const [detalle, setDetalle] = useState(null)
  const [etapaModal, setEtapaModal] = useState(null)
  const [pedidosModal, setPedidosModal] = useState(null)
  const r = useMemo(() => resumen(solicitudes), [solicitudes])
  const porA = useMemo(() => porAsignado(solicitudes), [solicitudes])
  const tiempos = useMemo(() => histogramaTiempos(solicitudes), [solicitudes])
  const zonas = useMemo(() => porZona(solicitudes), [solicitudes])
  const tipos = useMemo(() => porTipo(solicitudes), [solicitudes])
  const semana = useMemo(() => porDiaSemana(solicitudes), [solicitudes])
  const franjas = useMemo(() => porFranja(solicitudes), [solicitudes])
  const actividad = useMemo(() => seriesPorDia(solicitudes, 14), [solicitudes])
  const etapas = useMemo(() => tiempoPorEstado(solicitudes), [solicitudes])
  const conductores = useMemo(() => porConductor(solicitudes), [solicitudes])
  const clientes = useMemo(() => topClientes(solicitudes, 8), [solicitudes])
  const lentos = useMemo(() => lentosActivos(solicitudes, 48), [solicitudes])
  const encuestas = useMemo(() => resumenEncuestas(solicitudes), [solicitudes])
  const encConductores = useMemo(() => promedioPorConductorEncuesta(solicitudes), [solicitudes])
  const encClientes = useMemo(() => topClientesSatisfaccion(solicitudes, 8), [solicitudes])

  const filaEncuesta = (e) => ({
    id: e.id,
    cliente: e.cliente || '—',
    zona: e.zona || '—',
    estado: e.estado || '—',
    promedio: promedioDeEncuesta(e),
    votos: e.votos,
    fechaHora: e.fechaHora,
  })

  const abrirDetalle = (id) => setDetalle(solicitudes.find((s) => s.id === id) || null)

  const descargarPdf = async () => {
    try {
      await exportarPdf(informeRef.current, 'Informe_dashboard')
    } catch (error) {
      console.warn('[Dashboard] no se pudo exportar el PDF:', error)
    }
  }

  const descargarExcel = () => {
    try {
      exportarExcel(solicitudes)
    } catch (error) {
      console.warn('[Dashboard] no se pudo exportar el Excel:', error)
    }
  }

  if (solicitudes.length === 0) {
    return (
      <div className="rounded-3xl bg-white ring-1 ring-brand-ink/10 shadow-sm px-6 py-16 text-center">
        <div className="mx-auto grid place-items-center size-16 rounded-2xl bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/30 mb-4">
          <MdInsights className="text-3xl" />
        </div>
        <p className="text-lg font-extrabold text-brand-ink">Aún no hay datos para mostrar</p>
        <p className="text-sm text-brand-ink/50 mt-1">El dashboard se llenará cuando haya solicitudes registradas.</p>
      </div>
    )
  }

  const cumplimiento = r.total ? Math.round((r.entregados / r.total) * 100) : 0

  return (
    <>
    <div ref={informeRef} className="space-y-4 sm:space-y-6">
      {/* Exportar informe */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-brand-deep">
          <MdInsights className="text-brand-cyan" /> Panel de control
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={descargarPdf}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy text-white px-4 py-2 text-xs sm:text-sm font-bold hover:bg-brand-deep transition shadow-sm"
          >
            <MdPictureAsPdf className="text-base" />
            Exportar PDF
          </button>
          <button
            type="button"
            onClick={descargarExcel}
            className="inline-flex items-center gap-2 rounded-full border border-brand-deep/30 bg-brand-mist text-brand-deep px-4 py-2 text-xs sm:text-sm font-bold hover:bg-brand-cyan/15 transition"
          >
            <MdTableChart className="text-base" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4">
        <Kpi icon={<MdInbox />} accent="bg-gradient-to-br from-brand-navy to-brand-deep" label="Total de pedidos" value={r.total} />
        <Kpi icon={<MdPendingActions />} accent="bg-gradient-to-br from-brand-deep to-brand-cyan" label="Activos" value={r.activos} sub={`${r.enTransito} en tránsito`} />
        <Kpi icon={<MdCheckCircle />} accent="bg-gradient-to-br from-green-500 to-emerald-400" label="Entregados" value={r.entregados} sub={`${r.entregadosParcial} parciales`} />
        <Kpi icon={<MdTrendingUp />} accent="bg-gradient-to-br from-brand-cyan to-cyan-400" label="Cumplimiento" value={`${cumplimiento}%`} sub={`${r.entregados} de ${r.total}`} />
        <Kpi icon={<MdSchedule />} accent="bg-gradient-to-br from-amber-500 to-yellow-400" label="Tiempo promedio" value={formatHoras(r.tiempos.promedio)} sub={r.tiempos.cantidad ? `${r.tiempos.cantidad} entregas` : 'sin entregas'} />
        <Kpi icon={<MdLocalShipping />} accent="bg-gradient-to-br from-purple-500 to-fuchsia-400" label="En tránsito" value={r.enTransito} sub={solicitudes.filter((s) => (s.estado || '') === 'En Tránsito Parcial').length + ' parciales'} />
      </div>

      {/* Estado + quién los tiene */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Seccion icon={<MdDonutLarge />} titulo="Pedidos por estado">
          <Donut porEstado={r.porEstado} total={r.total} />
        </Seccion>
        <Seccion icon={<MdAssignmentInd />} titulo="Quién los tiene">
          <div className="max-h-80 overflow-y-auto [scrollbar-width:thin] pr-1">
            <BarrasAsignado
              items={porA}
              onClick={(i) =>
                setPedidosModal({
                  titulo: `Pedidos de ${i.nombre}`,
                  items: solicitudes
                    .filter((s) => (String(s.asignadoA || '').trim() || 'Sin asignar') === i.nombre)
                    .map((s) => ({
                      id: s.id,
                      cliente: s.cliente || '—',
                      zona: s.zona || '—',
                      estado: s.estado || 'Abierto',
                      fechaHora: `${s.fechaSubida || ''} ${s.horaSubida || ''}`.trim(),
                    })),
                })
              }
            />
          </div>
        </Seccion>
      </div>

      {/* Encuestas de satisfacción */}
      <Seccion icon={<MdStar />} titulo="Encuestas de satisfacción">
        {encuestas.total === 0 ? (
          <p className="text-sm text-brand-ink/50">Aún no hay encuestas de satisfacción registradas.</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Kpi icon={<MdStar />} accent="bg-gradient-to-br from-amber-500 to-yellow-400" label="Encuestas" value={encuestas.total} />
              <Kpi icon={<MdStarHalf />} accent="bg-gradient-to-br from-brand-deep to-brand-cyan" label="Promedio general" value={encuestas.promedio ? encuestas.promedio.toFixed(1) : '—'} />
              <Kpi icon={<MdThumbUp />} accent="bg-gradient-to-br from-green-500 to-emerald-400" label="Respuestas 3★" value={`${encuestas.pctTres}%`} />
              <Kpi icon={<MdPoll />} accent="bg-gradient-to-br from-purple-500 to-fuchsia-400" label="Entregas encuestadas" value={`${encuestas.pctEncuestadas}%`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="min-w-0">
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-brand-ink/50 mb-3">
                  Distribución por estrellas ({encuestas.votos} respuestas)
                </h3>
                <DistribucionEstrellas
                  items={encuestas.porEstrella}
                  total={encuestas.votos}
                  onClick={(s) =>
                    setPedidosModal({
                      titulo: `Respuesta ${s.nombre} · ${s.estrellas}★`,
                      items: encuestas.lista
                        .filter((e) => nivelEstrella(promedioDeEncuesta(e)) === s.estrellas)
                        .map(filaEncuesta),
                    })
                  }
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-brand-ink/50 mb-3">
                  Promedio por conductor
                </h3>
                <div className="max-h-80 overflow-y-auto [scrollbar-width:thin] pr-1">
                  <SatisfaccionLista
                    items={encConductores.map((c) => ({ nombre: c.nombre, valor: c.promedio, votos: c.votos }))}
                    onClick={(c) =>
                      setPedidosModal({
                        titulo: `Entregas encuestadas de ${c.nombre}`,
                        items: encuestas.lista.filter((e) => e.conductor === c.nombre).map(filaEncuesta),
                      })
                    }
                  />
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-brand-ink/50 mb-3">
                  Top clientes por satisfacción
                </h3>
                <div className="max-h-80 overflow-y-auto [scrollbar-width:thin] pr-1">
                  <SatisfaccionLista
                    items={encClientes.map((c) => ({ nombre: c.nombre, valor: c.promedio, votos: c.votos }))}
                    onClick={(c) =>
                      setPedidosModal({
                        titulo: `Entregas encuestadas de ${c.nombre}`,
                        items: encuestas.lista.filter((e) => e.cliente === c.nombre).map(filaEncuesta),
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Seccion>

      {/* Actividad reciente */}
      <Seccion icon={<MdBarChart />} titulo="Actividad últimos 14 días">
        <div className="mb-3">
          <EstadoMargen />
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[620px]">
            <BarrasActividad serie={actividad} />
          </div>
        </div>
      </Seccion>

      {/* Cuándo llegan los pedidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Seccion icon={<MdToday />} titulo="Pedidos por día de la semana">
          <Histograma items={semana.map((d) => ({ key: d.dia, label: d.nombre, count: d.count, color: '#003B73' }))} />
        </Seccion>
        <Seccion icon={<MdAccessTime />} titulo="Franja horaria de creación">
          <Histograma items={franjas.map((f) => ({ key: f.key, label: `${f.label} ${f.rango}`, count: f.count, color: f.color }))} />
        </Seccion>
      </div>

      {/* Zona + tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Seccion icon={<MdLocationPin />} titulo="Pedidos por zona">
          <BarrasH items={zonas.map((z) => ({ nombre: z.nombre, valor: z.count }))} />
        </Seccion>
        <Seccion icon={<MdCategory />} titulo="Pedidos por tipo de solicitud">
          <BarrasH items={tipos.map((t) => ({ nombre: t.nombre, valor: t.count }))} colorHex="#3B82F6" />
        </Seccion>
      </div>

      {/* Equipo + cuellos de botella */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Seccion icon={<MdHourglassEmpty />} titulo="Tiempo promedio por etapa">
          {etapas.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1.5">
              {etapas.map((e) => (
                <span key={e.estado} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brand-ink/50">
                  <span className="size-2 rounded-full" style={{ backgroundColor: HEX_ESTADO[e.estado] || '#94A3B8' }} />
                  {e.estado}
                </span>
              ))}
            </div>
          )}
          <BarrasH
            items={etapas.map((e) => ({
              nombre: e.estado,
              valor: e.promedio,
              n: e.n,
              colorHex: HEX_ESTADO[e.estado],
            }))}
            formato={(i) => `${formatHoras(i.valor)} · ${i.n ?? 0} ${i.n === 1 ? 'caso' : 'casos'}`}
            onClick={(i) => setEtapaModal(etapas.find((e) => e.estado === i.nombre))}
            hint="Ver los pedidos que estuvieron en esta etapa"
          />
        </Seccion>
        <Seccion icon={<MdLocalShipping />} titulo="Carga por conductor">
          <BarrasH
            items={conductores.map((c) => ({ nombre: c.nombre, valor: c.total, entregados: c.entregados }))}
            colorHex="#A855F7"
            formato={(i) => `${i.valor} · ${i.entregados} entregados`}
          />
        </Seccion>
      </div>

      {/* Clientes + atención */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <Seccion icon={<MdBusiness />} titulo="Top clientes">
          <BarrasH items={clientes.map((c) => ({ nombre: c.nombre, valor: c.count }))} colorHex="#F97316" />
        </Seccion>
        <Seccion icon={<MdWarning />} titulo="Requerir atención (activos > 2 días)">
          {lentos.length === 0 ? (
            <p className="text-sm text-brand-ink/50">Sin pedidos activos con más de 2 días. ¡Todo va al día!</p>
          ) : (
            <div className="space-y-2">
              {lentos.map((x) => (
                <div key={x.id} className="flex items-center gap-2.5 rounded-xl bg-brand-mist/50 ring-1 ring-brand-ink/5 px-3 py-2 text-sm">
                  <span className="shrink-0 font-extrabold text-brand-deep">{x.id}</span>
                  <span className="min-w-0 flex-1 truncate text-brand-ink/80">{x.cliente || '—'} <span className="text-brand-ink/40">· {x.zona || '—'}</span></span>
                  <span className={`hidden sm:inline-flex text-[10px] font-extrabold rounded-full px-2 py-0.5 ${getBadgeColor(x.estado)}`}>{x.estado}</span>
                  <span className="shrink-0 font-extrabold text-red-600 tabular-nums">{formatHoras(x.horas)}</span>
                </div>
              ))}
            </div>
          )}
        </Seccion>
      </div>

      {/* Tiempos de entrega */}
      <Seccion icon={<MdTimeline />} titulo="Tiempos de entrega (desde el inicio hasta la entrega)">
        <div className="grid grid-cols-1 xs:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl bg-brand-mist/60 ring-1 ring-brand-ink/5 p-3">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-ink/50">
              <MdAccessTime /> Promedio
            </span>
            <span className="block text-xl font-extrabold text-brand-ink mt-1">{formatHoras(r.tiempos.promedio)}</span>
          </div>
          <div className="rounded-xl bg-brand-mist/60 ring-1 ring-brand-ink/5 p-3">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-ink/50">
              <MdBarChart /> Mediana
            </span>
            <span className="block text-xl font-extrabold text-brand-ink mt-1">{formatHoras(r.tiempos.mediana)}</span>
          </div>
          <div className="rounded-xl bg-brand-mist/60 ring-1 ring-brand-ink/5 p-3">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-ink/50">
              <MdLocalShipping /> Máximo
            </span>
            <span className="block text-xl font-extrabold text-brand-ink mt-1">{formatHoras(r.tiempos.max)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-brand-ink/50 mb-3">Distribución por rango</h3>
            <Histograma items={tiempos.buckets} />
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-brand-ink/50 mb-3">Promedio por responsable</h3>
            {tiempos.promedioPorNombre.length === 0 ? (
              <p className="text-sm text-brand-ink/50">Aún no hay entregas con tiempo medible</p>
            ) : (
              <div className="space-y-2.5">
                {tiempos.promedioPorNombre.slice(0, 8).map((p) => {
                  const max = tiempos.promedioPorNombre[0]?.promedio || 1
                  return (
                    <div key={p.nombre} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-bold text-brand-deep">{p.nombre}</span>
                        <span className="shrink-0 font-extrabold text-brand-ink tabular-nums">{formatHoras(p.promedio)}</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-brand-mist ring-1 ring-brand-ink/5">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-brand-deep to-brand-cyan"
                          style={{ width: `${Math.max(4, (p.promedio / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {tiempos.ultimasEntregas.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-brand-ink/50 mb-3">Últimas entregas</h3>
            <div className="rounded-xl border border-brand-ink/10 max-h-[26rem] overflow-y-auto [scrollbar-width:thin]">
              {tiempos.ultimasEntregas.map((e, i) => (
                <button
                  type="button"
                  key={e.id + e.fechaHora + i}
                  onClick={() => abrirDetalle(e.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-brand-cyan/10 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-brand-cyan/5'} border-b border-brand-ink/5 last:border-0`}
                  title={`Ver detalle de ${e.id}`}
                >
                  <span className="shrink-0 font-extrabold text-brand-deep">{e.id}</span>
                  <span className="min-w-0 flex-1 truncate text-brand-ink/80">
                    {e.cliente || '—'} <span className="text-brand-ink/40">· {e.zona || '—'}</span>
                  </span>
                  <span className={`hidden sm:inline-flex text-[10px] font-extrabold rounded-full px-2 py-0.5 ${getBadgeColor(e.estado)}`}>
                    {e.estado}
                  </span>
                  <span className="shrink-0 font-extrabold text-brand-ink tabular-nums">{formatHoras(e.horas)}</span>
                  <MdChevronRight className="shrink-0 text-brand-deep/40" />
                </button>
              ))}
            </div>
          </div>
        )}
      </Seccion>

      {/* Listado completo de pedidos */}
      <Seccion icon={<MdList />} titulo={`Pedidos (${solicitudes.length})`}>
        <div className="rounded-xl border border-brand-ink/10 max-h-[26rem] overflow-y-auto [scrollbar-width:thin]">
          {solicitudes.map((s, i) => (
            <button
              type="button"
              key={s.id}
              onClick={() => abrirDetalle(s.id)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-brand-cyan/10 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-brand-cyan/5'} border-b border-brand-ink/5 last:border-0`}
              title={`Ver detalle de ${s.id}`}
            >
              <span className="shrink-0 font-extrabold text-brand-deep">{s.id}</span>
              <span className="min-w-0 flex-1 truncate text-brand-ink/80">
                {s.cliente || '—'} <span className="text-brand-ink/40">· {s.zona || '—'}</span>
              </span>
              <span className={`hidden md:inline-flex text-[10px] font-extrabold rounded-full px-2 py-0.5 ${getBadgeColor(s.estado || 'Abierto')}`}>
                {s.estado || 'Abierto'}
              </span>
              <span className="hidden sm:inline-block text-[11px] font-bold text-brand-ink/50 truncate max-w-32">
                {nombreDeAsignado(s.asignadoA) || 'Sin asignar'}
              </span>
              <span className="shrink-0 text-[11px] font-bold text-brand-ink/40 tabular-nums">{s.fechaSubida}</span>
              <MdChevronRight className="shrink-0 text-brand-deep/40" />
            </button>
          ))}
        </div>
      </Seccion>
    </div>

    <PedidoDetalleModal
      solicitud={detalle}
      open={detalle !== null}
      onClose={() => setDetalle(null)}
    />

    <EtapaPedidosModal
      etapa={etapaModal}
      open={etapaModal !== null}
      onClose={() => setEtapaModal(null)}
      onVerPedido={(id) => {
        setEtapaModal(null)
        abrirDetalle(id)
      }}
    />

    <PedidosListaModal
      titulo={pedidosModal?.titulo}
      items={pedidosModal?.items || []}
      open={pedidosModal !== null}
      onClose={() => setPedidosModal(null)}
      onVerPedido={(id) => {
        setPedidosModal(null)
        abrirDetalle(id)
      }}
    />
    </>
  )
}