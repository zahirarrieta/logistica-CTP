import { useMemo, useState } from 'react'
import {
  MdInsights,
  MdInbox,
  MdCheckCircle,
  MdPendingActions,
  MdLocalShipping,
  MdTrendingUp,
  MdSchedule,
  MdBarChart,
  MdDonutLarge,
  MdLocationPin,
  MdCategory,
  MdTimeline,
  MdList,
  MdChevronRight,
} from 'react-icons/md'
import {
  resumen,
  porZona,
  porTipo,
  seriesPorDia,
  histogramaTiempos,
  formatHoras,
} from '../../Administrador/Components/dashboardUtils.js'
import { getBadgeColor } from '../../Home/Components/estadoColors.js'
import PedidoDetalleModal from '../../Administrador/Components/modals/PedidoDetalleModal.jsx'
import {
  Kpi,
  Seccion,
  Donut,
  BarrasH,
  Histograma,
  BarrasActividad,
  EstadoMargen,
} from '../../Administrador/Components/DashboardTab.jsx'

export default function ConductorDashboard({ solicitudes }) {
  const [detalle, setDetalle] = useState(null)
  const r = useMemo(() => resumen(solicitudes), [solicitudes])
  const zonas = useMemo(() => porZona(solicitudes), [solicitudes])
  const tipos = useMemo(() => porTipo(solicitudes), [solicitudes])
  const actividad = useMemo(() => seriesPorDia(solicitudes, 14), [solicitudes])
  const tiempos = useMemo(() => histogramaTiempos(solicitudes), [solicitudes])

  const abrirDetalle = (id) => setDetalle(solicitudes.find((s) => s.id === id) || null)

  if (solicitudes.length === 0) {
    return (
      <div className="rounded-3xl bg-white ring-1 ring-brand-ink/10 shadow-sm px-6 py-16 text-center">
        <div className="mx-auto grid place-items-center size-16 rounded-2xl bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/30 mb-4">
          <MdInsights className="text-3xl" />
        </div>
        <p className="text-lg font-extrabold text-brand-ink">Aún no hay datos para mostrar</p>
        <p className="text-sm text-brand-ink/50 mt-1">
          El dashboard se llenará con las entregas asignadas a ti en tránsito o entregadas.
        </p>
      </div>
    )
  }

  const cumplimiento = r.total ? Math.round((r.entregados / r.total) * 100) : 0
  const enTransitoParcial = solicitudes.filter((s) => (s.estado || '') === 'En Tránsito Parcial').length

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        {/* Encabezado */}
        <div>
          <h2 className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-brand-deep">
            <MdInsights className="text-brand-cyan" /> Panel de entregas
          </h2>
          <p className="text-xs sm:text-sm text-brand-ink/50 mt-1">
            Solo lo asignado a ti en tránsito o entregado.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3 sm:gap-4">
          <Kpi icon={<MdInbox />} accent="bg-gradient-to-br from-brand-navy to-brand-deep" label="Total asignados" value={r.total} />
          <Kpi icon={<MdLocalShipping />} accent="bg-gradient-to-br from-purple-500 to-fuchsia-400" label="En tránsito" value={r.enTransito} sub={`${enTransitoParcial} parcial(es)`} />
          <Kpi icon={<MdCheckCircle />} accent="bg-gradient-to-br from-green-500 to-emerald-400" label="Entregados" value={r.entregados} sub={`${r.entregadosParcial} parciales`} />
          <Kpi icon={<MdTrendingUp />} accent="bg-gradient-to-br from-brand-cyan to-cyan-400" label="Cumplimiento" value={`${cumplimiento}%`} sub={`${r.entregados} de ${r.total}`} />
          <Kpi icon={<MdSchedule />} accent="bg-gradient-to-br from-amber-500 to-yellow-400" label="Tiempo promedio" value={formatHoras(r.tiempos.promedio)} sub={r.tiempos.cantidad ? `${r.tiempos.cantidad} entregas` : 'sin entregas'} />
        </div>

        {/* Estado + actividad */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <Seccion icon={<MdDonutLarge />} titulo="Mis pedidos por estado">
            <Donut porEstado={r.porEstado} total={r.total} />
          </Seccion>
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
        </div>

        {/* Zona + tipo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <Seccion icon={<MdLocationPin />} titulo="Mis pedidos por zona">
            <BarrasH items={zonas.map((z) => ({ nombre: z.nombre, valor: z.count }))} />
          </Seccion>
          <Seccion icon={<MdCategory />} titulo="Mis pedidos por tipo de solicitud">
            <BarrasH items={tipos.map((t) => ({ nombre: t.nombre, valor: t.count }))} colorHex="#3B82F6" />
          </Seccion>
        </div>

        {/* Tiempos de entrega */}
        <Seccion icon={<MdTimeline />} titulo="Mis tiempos de entrega">
          <div className="grid grid-cols-1 xs:grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl bg-brand-mist/60 ring-1 ring-brand-ink/5 p-3">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-ink/50">
                <MdSchedule /> Promedio
              </span>
              <span className="block text-xl font-extrabold text-brand-ink mt-1">{formatHoras(r.tiempos.promedio)}</span>
            </div>
            <div className="rounded-xl bg-brand-mist/60 ring-1 ring-brand-ink/5 p-3">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-ink/50">
                <MdLocalShipping /> Mediana
              </span>
              <span className="block text-xl font-extrabold text-brand-ink mt-1">{formatHoras(r.tiempos.mediana)}</span>
            </div>
            <div className="rounded-xl bg-brand-mist/60 ring-1 ring-brand-ink/5 p-3">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-ink/50">
                <MdCheckCircle /> Máximo
              </span>
              <span className="block text-xl font-extrabold text-brand-ink mt-1">{formatHoras(r.tiempos.max)}</span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-brand-ink/50 mb-3">Distribución por rango</h3>
            <Histograma items={tiempos.buckets} />
          </div>

          {tiempos.ultimasEntregas.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-brand-ink/50 mb-3">Últimas entregas</h3>
              <div className="overflow-hidden rounded-xl border border-brand-ink/10">
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

        {/* Listado de mis pedidos */}
        <Seccion icon={<MdList />} titulo={`Mis pedidos (${solicitudes.length})`}>
          <div className="overflow-hidden rounded-xl border border-brand-ink/10">
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
    </>
  )
}