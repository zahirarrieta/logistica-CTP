import { useMemo, useRef, useState } from 'react'
import {
  MdInsights,
  MdInbox,
  MdCheckCircle,
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
  MdBlock,
  MdErrorOutline,
  MdDescription,
} from 'react-icons/md'
import {
  Kpi,
  Seccion,
  Donut,
  BarrasH,
  Histograma,
  BarrasActividad,
  BarrasAsignado,
  EstadoMargen,
} from './DashboardTab.jsx'
import {
  resumenRecolecciones,
  porAsignadoRec,
  porConductorRec,
  porZonaRec,
  porTipoServicio,
  topClientesRec,
  porDiaSemanaRec,
  porFranjaRec,
  seriesPorDiaRec,
  tiempoPorEstadoRec,
  histogramaTiemposRec,
  lentosActivosRec,
  HEX_ESTADO_REC,
  ESTADOS_TRANSITO_REC,
  ESTADOS_CERRADOS_REC,
  esActivaRec,
  guiasRecoleccion,
  formatHoras,
} from '../../../utils/recoleccionesDashboard.js'
import { getBadgeColor } from '../../../utils/estadoColors.js'
import { exportarPdf, exportarExcelRecolecciones } from '../../../services/exportarInforme.js'
import PedidosListaModal from './modals/PedidosListaModal.jsx'
import RecoleccionDetalleModal from '../../Recolecciones/Components/modals/RecoleccionDetalleModal.jsx'

const MESES = [
  { v: 1, n: 'Enero' }, { v: 2, n: 'Febrero' }, { v: 3, n: 'Marzo' },
  { v: 4, n: 'Abril' }, { v: 5, n: 'Mayo' }, { v: 6, n: 'Junio' },
  { v: 7, n: 'Julio' }, { v: 8, n: 'Agosto' }, { v: 9, n: 'Septiembre' },
  { v: 10, n: 'Octubre' }, { v: 11, n: 'Noviembre' }, { v: 12, n: 'Diciembre' },
]

export default function RecoleccionesDashboard({
  recolecciones: todasRecolecciones = [],
  onFilterMes,
  onFilterAno,
  titulo = 'Panel de control de recolecciones',
  subtitulo,
  puedeExportar = true,
}) {
  const informeRef = useRef(null)
  const [detalle, setDetalle] = useState(null)
  const [lista, setLista] = useState(null)
  const [mesFiltro, setMesFiltro] = useState('')
  const [anoFiltro, setAnoFiltro] = useState('')

  const recoleccionesFiltradas = useMemo(() => {
    if (!mesFiltro && !anoFiltro) return todasRecolecciones
    return todasRecolecciones.filter((rec) => {
      const partes = String(rec.fecha_subida || '').split(/[/\-.]/)
      if (partes.length !== 3) return false
      const d = Number(partes[0])
      const m = Number(partes[1])
      let y = Number(partes[2])
      if (!d || !m || !y) return false
      if (y < 100) y = y >= 50 ? 1900 + y : 2000 + y
      if (mesFiltro && m !== Number(mesFiltro)) return false
      if (anoFiltro && y !== Number(anoFiltro)) return false
      return true
    })
  }, [todasRecolecciones, mesFiltro, anoFiltro])

  const r = useMemo(() => resumenRecolecciones(recoleccionesFiltradas), [recoleccionesFiltradas])
  const asignados = useMemo(() => porAsignadoRec(recoleccionesFiltradas), [recoleccionesFiltradas])
  const conductores = useMemo(() => porConductorRec(recoleccionesFiltradas), [recoleccionesFiltradas])
  const zonas = useMemo(() => porZonaRec(recoleccionesFiltradas), [recoleccionesFiltradas])
  const tipos = useMemo(() => porTipoServicio(recoleccionesFiltradas), [recoleccionesFiltradas])
  const clientes = useMemo(() => topClientesRec(recoleccionesFiltradas, 8), [recoleccionesFiltradas])
  const semana = useMemo(() => porDiaSemanaRec(recoleccionesFiltradas), [recoleccionesFiltradas])
  const franjas = useMemo(() => porFranjaRec(recoleccionesFiltradas), [recoleccionesFiltradas])
  const actividad = useMemo(() => seriesPorDiaRec(recoleccionesFiltradas, 14), [recoleccionesFiltradas])
  const etapas = useMemo(() => tiempoPorEstadoRec(recoleccionesFiltradas), [recoleccionesFiltradas])
  const tiempos = useMemo(() => histogramaTiemposRec(recoleccionesFiltradas), [recoleccionesFiltradas])
  const lentos = useMemo(() => lentosActivosRec(recoleccionesFiltradas, 48), [recoleccionesFiltradas])

  const anosDisponibles = useMemo(() => {
    const anos = new Set()
    for (const rec of todasRecolecciones) {
      const partes = String(rec.fecha_subida || '').split(/[/\-.]/)
      if (partes.length !== 3) continue
      let y = Number(partes[2])
      if (!y) continue
      if (y < 100) y = y >= 50 ? 1900 + y : 2000 + y
      anos.add(y)
    }
    return [...anos].sort((a, b) => b - a)
  }, [todasRecolecciones])

  const fila = (rec) => ({
    id: rec.codigo,
    cliente: rec.recoge_cliente || '—',
    zona: rec.zona || '—',
    estado: rec.estado || 'Abierto',
    fechaHora: `${rec.fecha_subida || ''} ${rec.hora_subida || ''}`.trim(),
  })

  const abrirLista = (titulo, listaRec) => setLista({ titulo, items: listaRec.map(fila) })
  const abrirDetalle = (id) => setDetalle(recoleccionesFiltradas.find((rec) => rec.codigo === id) || null)

  const descargarPdf = async () => {
    try {
      await exportarPdf(informeRef.current, 'Informe_recolecciones')
    } catch (error) {
      console.warn('[Dashboard recolecciones] no se pudo exportar el PDF:', error)
    }
  }

  const descargarExcel = () => {
    try {
      exportarExcelRecolecciones(recoleccionesFiltradas)
    } catch (error) {
      console.warn('[Dashboard recolecciones] no se pudo exportar el Excel:', error)
    }
  }

  const hayFiltroRec = Boolean(mesFiltro || anoFiltro)
  if (recoleccionesFiltradas.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {
            <select
              value={mesFiltro}
              onChange={(e) => { const val = e.target.value; setMesFiltro(val); onFilterMes?.(val ? Number(val) : null) }}
              className="rounded-xl border border-brand-deep/20 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:outline-none transition-all"
              title="Filtrar por mes"
            >
              <option value="">Todos los meses</option>
              {MESES.map((m) => (
                <option key={m.v} value={m.v}>{m.n}</option>
              ))}
            </select>
          }
          {
            <select
              value={anoFiltro}
              onChange={(e) => { const val = e.target.value; setAnoFiltro(val); onFilterAno?.(val ? Number(val) : null) }}
              className="rounded-xl border border-brand-deep/20 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:outline-none transition-all"
              title="Filtrar por año"
            >
              <option value="">Todos los años</option>
              {anosDisponibles.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          }
          {hayFiltroRec && (
            <button
              type="button"
              onClick={() => { setMesFiltro(''); setAnoFiltro(''); onFilterMes?.(null); onFilterAno?.(null) }}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-ink/10 text-brand-deep hover:bg-brand-ink/20 transition-colors px-3.5 py-2 text-sm font-bold"
            >
              Limpiar filtro
            </button>
          )}
        </div>
        <div className="rounded-3xl bg-white ring-1 ring-brand-ink/10 shadow-sm px-6 py-16 text-center">
          <div className="mx-auto grid place-items-center size-16 rounded-2xl bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/30 mb-4">
            <MdInsights className="text-3xl" />
          </div>
          <p className="text-lg font-extrabold text-brand-ink">
            {hayFiltroRec ? 'No hay datos para el filtro seleccionado' : 'Aún no hay datos para mostrar'}
          </p>
          <p className="text-sm text-brand-ink/50 mt-1">
            {hayFiltroRec ? 'Cambia el mes o el año, o pulsa «Limpiar filtro».' : 'El dashboard se llenará cuando haya recolecciones registradas.'}
          </p>
        </div>
      </div>
    )
  }

  const cumplimiento = r.total ? Math.round(((r.entregadas + r.canceladas) / r.total) * 100) : 0

  const handleMesChange = (e) => {
    const val = e.target.value
    setMesFiltro(val)
    onFilterMes?.(val ? Number(val) : null)
  }
  const handleAnoChange = (e) => {
    const val = e.target.value
    setAnoFiltro(val)
    onFilterAno?.(val ? Number(val) : null)
  }

  return (
    <>
      <div ref={informeRef} className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-brand-deep">
              <MdInsights className="text-brand-cyan" /> {titulo}
            </h2>
            {subtitulo && <p className="text-xs sm:text-sm text-brand-ink/50 mt-1">{subtitulo}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {
              <select
                value={mesFiltro}
                onChange={handleMesChange}
                className="rounded-xl border border-brand-deep/20 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:outline-none transition-all"
                title="Filtrar por mes"
              >
                <option value="">Todos los meses</option>
                {MESES.map((m) => (
                  <option key={m.v} value={m.v}>{m.n}</option>
                ))}
              </select>
            }
            {
              <select
                value={anoFiltro}
                onChange={handleAnoChange}
                className="rounded-xl border border-brand-deep/20 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 focus:outline-none transition-all"
                title="Filtrar por año"
              >
                <option value="">Todos los años</option>
                {anosDisponibles.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            }
            {puedeExportar && (
              <>
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
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
          <Kpi
            icon={<MdInbox />}
            accent="bg-gradient-to-br from-brand-navy to-brand-deep"
            label="Total recolecciones"
            value={r.total}
            onClick={() => abrirLista('Todas las recolecciones', recoleccionesFiltradas)}
          />
          <Kpi
            icon={<MdPendingActions />}
            accent="bg-gradient-to-br from-brand-deep to-brand-cyan"
            label="Activas"
            value={r.activas}
            sub={`${r.enTransito} en tránsito`}
            onClick={() => abrirLista('recolecciones activas', recoleccionesFiltradas.filter(esActivaRec))}
          />
          <Kpi
            icon={<MdAssignmentInd />}
            accent="bg-gradient-to-br from-blue-500 to-sky-400"
            label="En trámite"
            value={r.enTramite}
            onClick={() => abrirLista('recolecciones en trámite', recoleccionesFiltradas.filter((rec) => (rec.estado || '') === 'En Trámite'))}
          />
          <Kpi
            icon={<MdLocalShipping />}
            accent="bg-gradient-to-br from-purple-500 to-fuchsia-400"
            label="En tránsito"
            value={r.enTransito}
            onClick={() => abrirLista('recolecciones en tránsito', recoleccionesFiltradas.filter((rec) => ESTADOS_TRANSITO_REC.includes(rec.estado || '')))}
          />
          <Kpi
            icon={<MdCheckCircle />}
            accent="bg-gradient-to-br from-green-500 to-emerald-400"
            label="Entregadas"
            value={r.entregadas}
            onClick={() => abrirLista('recolecciones entregadas', recoleccionesFiltradas.filter((rec) => (rec.estado || '') === 'Entregado'))}
          />
          <Kpi
            icon={<MdBlock />}
            accent="bg-gradient-to-br from-slate-500 to-slate-400"
            label="Canceladas"
            value={r.canceladas}
            onClick={() => abrirLista('recolecciones canceladas', recoleccionesFiltradas.filter((rec) => (rec.estado || '') === 'Cancelado'))}
          />
          <Kpi
            icon={<MdErrorOutline />}
            accent="bg-gradient-to-br from-rose-700 to-rose-500"
            label="Fallidas"
            value={r.fallidas}
            onClick={() => abrirLista('recolecciones fallidas', recoleccionesFiltradas.filter((rec) => (rec.estado || '') === 'Fallido'))}
          />
          <Kpi
            icon={<MdTrendingUp />}
            accent="bg-gradient-to-br from-brand-cyan to-cyan-400"
            label="Cumplimiento"
            value={`${cumplimiento}%`}
            sub={`${r.entregadas + r.canceladas} de ${r.total}`}
            onClick={() => abrirLista('recolecciones resueltas (entregadas + canceladas)', recoleccionesFiltradas.filter((rec) => ESTADOS_CERRADOS_REC.includes(rec.estado || '')))}
          />
          <Kpi
            icon={<MdAccessTime />}
            accent="bg-gradient-to-br from-amber-500 to-yellow-400"
            label="Tiempo promedio"
            value={formatHoras(r.tiempos.promedio)}
            sub={`${r.tiempos.cantidad} con entrega`}
            onClick={() => abrirLista('recolecciones entregadas', recoleccionesFiltradas.filter((rec) => (rec.estado || '') === 'Entregado'))}
          />
          <Kpi
            icon={<MdDescription />}
            accent="bg-gradient-to-br from-indigo-500 to-violet-400"
            label="Con guía de transporte"
            value={r.conGuia}
            onClick={() => abrirLista('recolecciones con guía de transporte', recoleccionesFiltradas.filter((rec) => guiasRecoleccion(rec).length > 0))}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <Seccion icon={<MdDonutLarge />} titulo="recolecciones por estado">
            <Donut porEstado={r.porEstado} total={r.total} />
          </Seccion>
          <Seccion icon={<MdAssignmentInd />} titulo="Quién las tiene">
            <div className="max-h-80 overflow-y-auto [scrollbar-width:thin] pr-1">
              <BarrasAsignado
                items={asignados}
                hint="Ver las recolecciones asignadas"
                onClick={(i) =>
                  abrirLista(
                    `recolecciones de ${i.nombre}`,
                    recoleccionesFiltradas.filter((rec) => (String(rec.asignado_a || '').trim() || 'Sin asignar') === i.nombre)
                  )
                }
              />
            </div>
          </Seccion>
        </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <Seccion icon={<MdToday />} titulo="recolecciones por día de la semana">
            <Histograma items={semana.map((d) => ({ key: d.dia, label: d.nombre, count: d.count, color: '#003B73' }))} />
          </Seccion>
          <Seccion icon={<MdAccessTime />} titulo="Franja horaria de creación">
            <Histograma items={franjas.map((f) => ({ key: f.key, label: `${f.label} ${f.rango}`, count: f.count, color: f.color }))} />
          </Seccion>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <Seccion icon={<MdLocationPin />} titulo="recolecciones por zona">
            <BarrasH items={zonas.map((z) => ({ nombre: z.nombre, valor: z.count }))} />
          </Seccion>
          <Seccion icon={<MdCategory />} titulo="recolecciones por tipo de servicio">
            <BarrasH items={tipos.map((t) => ({ nombre: t.nombre, valor: t.count }))} colorHex="#3B82F6" />
          </Seccion>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <Seccion icon={<MdHourglassEmpty />} titulo="Tiempo promedio por etapa">
            {etapas.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1.5">
                {etapas.map((e) => (
                  <span key={e.estado} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brand-ink/50">
                    <span className="size-2 rounded-full" style={{ backgroundColor: HEX_ESTADO_REC[e.estado] || '#94A3B8' }} />
                    {e.estado}
                  </span>
                ))}
              </div>
            )}
            <BarrasH
              items={etapas.map((e) => ({ nombre: e.estado, valor: e.promedio, n: e.n }))}
              colorHex="#0EA5E9"
              formato={(i) => `${formatHoras(i.valor)} · ${i.n ?? 0} ${i.n === 1 ? 'caso' : 'casos'}`}
              hint="Ver las recolecciones que estuvieron en esta etapa"
              onClick={(i) => {
                const etapa = etapas.find((e) => e.estado === i.nombre)
                if (!etapa) return
                setLista({
                  titulo: `recolecciones en «${etapa.estado}»`,
                  items: etapa.pedidos.map((p) => ({ id: p.id, cliente: p.cliente, zona: p.zona, estado: etapa.estado, fechaHora: p.entro })),
                })
              }}
            />
          </Seccion>
          <Seccion icon={<MdLocalShipping />} titulo="Carga por conductor">
            <BarrasH
              items={conductores.map((c) => ({ nombre: c.nombre, valor: c.total, entregados: c.entregados }))}
              colorHex="#A855F7"
              formato={(i) => `${i.valor} · ${i.entregados} entregadas`}
            />
          </Seccion>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <Seccion icon={<MdBusiness />} titulo="Top clientes">
            <BarrasH items={clientes.map((c) => ({ nombre: c.nombre, valor: c.count }))} colorHex="#F97316" />
          </Seccion>
          <Seccion icon={<MdWarning />} titulo="Requerir atención (activas > 2 días)">
            {lentos.length === 0 ? (
              <p className="text-sm text-brand-ink/50">Sin recolecciones activas con más de 2 días. ¡Todo va al día!</p>
            ) : (
              <div className="space-y-2">
                {lentos.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => abrirDetalle(x.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl bg-brand-mist/50 ring-1 ring-brand-ink/5 px-3 py-2 text-sm text-left hover:bg-brand-cyan/10 transition-colors"
                    title={`Ver detalle de ${x.id}`}
                  >
                    <span className="shrink-0 font-extrabold text-brand-deep">{x.id}</span>
                    <span className="min-w-0 flex-1 truncate text-brand-ink/80">{x.cliente || '—'} <span className="text-brand-ink/40">· {x.zona || '—'}</span></span>
                    <span className={`hidden sm:inline-flex text-[10px] font-extrabold rounded-full px-2 py-0.5 ${getBadgeColor(x.estado)}`}>{x.estado}</span>
                    <span className="shrink-0 font-extrabold text-red-600 tabular-nums">{formatHoras(x.horas)}</span>
                  </button>
                ))}
              </div>
            )}
          </Seccion>
        </div>

        <Seccion icon={<MdTimeline />} titulo="Tiempos de entrega (desde la creación hasta la entrega)">
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
            <div className="min-w-0">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-brand-ink/50 mb-3">Distribución por rango</h3>
              <Histograma items={tiempos.buckets} />
            </div>
            <div className="min-w-0">
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
                          <span className="block h-full rounded-full bg-gradient-to-r from-brand-deep to-brand-cyan" style={{ width: `${(p.promedio / max) * 100}%` }} />
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
              <div className="rounded-xl border border-brand-ink/10 max-h-80 overflow-y-auto [scrollbar-width:thin]">
                {tiempos.ultimasEntregas.map((e, i) => (
                  <button
                    type="button"
                    key={e.id + e.fechaHora + i}
                    onClick={() => abrirDetalle(e.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-brand-cyan/10 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-brand-cyan/5'} border-b border-brand-ink/5 last:border-0`}
                    title={`Ver detalle de ${e.id}`}
                  >
                    <span className="shrink-0 font-extrabold text-brand-deep">{e.id}</span>
                    <span className="min-w-0 flex-1 truncate text-brand-ink/80">{e.cliente || '—'} <span className="text-brand-ink/40">· {e.zona || '—'}</span></span>
                    <span className={`hidden sm:inline-flex text-[10px] font-extrabold rounded-full px-2 py-0.5 ${getBadgeColor(e.estado)}`}>{e.estado}</span>
                    <span className="shrink-0 font-extrabold text-brand-ink tabular-nums">{formatHoras(e.horas)}</span>
                    <MdChevronRight className="shrink-0 text-brand-deep/40" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </Seccion>

        <Seccion icon={<MdList />} titulo={`recolecciones (${recoleccionesFiltradas.length})`}>
          <div className="rounded-xl border border-brand-ink/10 max-h-[26rem] overflow-y-auto [scrollbar-width:thin]">
            {recoleccionesFiltradas.map((rec, i) => (
              <button
                type="button"
                key={rec.codigo}
                onClick={() => abrirDetalle(rec.codigo)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-brand-cyan/10 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-brand-cyan/5'} border-b border-brand-ink/5 last:border-0`}
                title={`Ver detalle de ${rec.codigo}`}
              >
                <span className="shrink-0 font-extrabold text-brand-deep">{rec.codigo}</span>
                <span className="min-w-0 flex-1 truncate text-brand-ink/80">
                  {rec.recoge_cliente || '—'} <span className="text-brand-ink/40">· {rec.zona || '—'}</span>
                </span>
                <span className={`hidden md:inline-flex text-[10px] font-extrabold rounded-full px-2 py-0.5 ${getBadgeColor(rec.estado || 'Abierto')}`}>
                  {rec.estado || 'Abierto'}
                </span>
                <span className="hidden sm:inline-block text-[11px] font-bold text-brand-ink/50 truncate max-w-32">
                  {rec.asignado_a || 'Sin asignar'}
                </span>
                <span className="shrink-0 text-[11px] font-bold text-brand-ink/40 tabular-nums">{rec.fecha_subida}</span>
                <MdChevronRight className="shrink-0 text-brand-deep/40" />
              </button>
            ))}
          </div>
        </Seccion>
      </div>

      <PedidosListaModal
        titulo={lista?.titulo}
        items={lista?.items || []}
        open={lista !== null}
        onClose={() => setLista(null)}
        onVerPedido={(id) => {
          setLista(null)
          abrirDetalle(id)
        }}
      />

      <RecoleccionDetalleModal
        open={detalle !== null}
        recoleccion={detalle}
        onClose={() => setDetalle(null)}
      />
    </>
  )
}
