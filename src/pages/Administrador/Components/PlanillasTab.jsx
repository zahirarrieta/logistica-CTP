import { useMemo, useState } from 'react'
import {
  MdDescription,
  MdSearch,
  MdLocalShipping,
  MdTag,
  MdAssignment,
  MdPerson,
  MdPlace,
  MdCategory,
  MdInbox,
  MdFilterList,
} from 'react-icons/md'
import { nombreDeAsignado } from '../../Home/Components/solicitudesStore.js'
import { getBadgeColor } from '../../Home/Components/estadoColors.js'
import PlanillaModal from './modals/PlanillaModal.jsx'
import { loadPlanillas } from './planillaStore.js'

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']

function initials(name) {
  return String(name || '?')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function PlanillasTab({ solicitudes = [] }) {
  const [busqueda, setBusqueda] = useState('')
  const [conductorFiltro, setConductorFiltro] = useState('todos')
  const [planillaAbierta, setPlanillaAbierta] = useState(null)
  const [planillas, setPlanillas] = useState(() => loadPlanillas())

  const grupos = useMemo(() => {
    const mapa = new Map()
    for (const s of solicitudes) {
      if (!ESTADOS_TRANSITO.includes(s.estado)) continue
      const conductor = nombreDeAsignado(s.conductor)
      if (!conductor) continue
      if (!mapa.has(conductor)) mapa.set(conductor, [])
      mapa.get(conductor).push(s)
    }
    return [...mapa.entries()]
      .map(([conductor, items]) => ({ conductor, items }))
      .sort((a, b) => a.conductor.localeCompare(b.conductor))
  }, [solicitudes])

  const detalle = useMemo(
    () =>
      grupos.map(({ conductor }) => {
        const p = planillas[conductor.trim().toLowerCase()] || {}
        const ocultas = new Set(p.filasOcultas || [])
        const agregadas = new Set(p.filasAgregadas || [])
        const delConductor = solicitudes.filter((s) => nombreDeAsignado(s.conductor) === conductor)
        const filas = delConductor.filter(
          (s) => (ESTADOS_TRANSITO.includes(s.estado) || agregadas.has(s.id)) && !ocultas.has(s.id)
        )
        const extras = p.filasExtra || []
        const conDatos = delConductor.find((s) => s.vehiculo || s.placa) || delConductor[0] || {}
        return {
          conductor,
          filas,
          extras,
          total: filas.length + extras.length,
          vehiculo: p.vehiculo || conDatos.vehiculo || '',
          placa: p.placa || conDatos.placa || '',
        }
      }),
    [grupos, planillas, solicitudes]
  )

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return detalle.filter((d) => {
      if (conductorFiltro !== 'todos' && d.conductor !== conductorFiltro) return false
      if (q && !d.conductor.toLowerCase().includes(q)) return false
      return true
    })
  }, [detalle, busqueda, conductorFiltro])

  const totalPedidos = detalle.reduce((acc, d) => acc + d.total, 0)

  const cerrarModal = () => {
    setPlanillaAbierta(null)
    setPlanillas(loadPlanillas())
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white ring-1 ring-brand-ink/10 shadow-sm p-4 flex items-center gap-3.5">
          <span className="grid place-items-center size-10 rounded-xl text-white text-xl shadow-md bg-gradient-to-br from-brand-navy to-brand-deep">
            <MdLocalShipping />
          </span>
          <span className="min-w-0">
            <span className="block text-2xl font-extrabold text-brand-ink leading-none">{detalle.length}</span>
            <span className="block text-[11px] font-bold text-brand-ink/50 uppercase tracking-wide mt-1">Conductores en ruta</span>
          </span>
        </div>
        <div className="rounded-2xl bg-white ring-1 ring-brand-ink/10 shadow-sm p-4 flex items-center gap-3.5">
          <span className="grid place-items-center size-10 rounded-xl text-white text-xl shadow-md bg-gradient-to-br from-brand-deep to-brand-cyan">
            <MdDescription />
          </span>
          <span className="min-w-0">
            <span className="block text-2xl font-extrabold text-brand-ink leading-none">{totalPedidos}</span>
            <span className="block text-[11px] font-bold text-brand-ink/50 uppercase tracking-wide mt-1">Pedidos en planilla</span>
          </span>
        </div>
      </div>

      {grupos.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex items-center gap-2 rounded-2xl bg-white ring-1 ring-brand-ink/10 shadow-sm px-3.5 py-2.5 flex-1">
            <MdSearch className="text-brand-deep shrink-0" />
            <input
              className="w-full bg-transparent text-sm font-semibold text-brand-ink outline-none placeholder:text-brand-ink/40"
              placeholder="Buscar conductor…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 rounded-2xl bg-white ring-1 ring-brand-ink/10 shadow-sm px-3.5 py-2.5">
            <MdFilterList className="text-brand-deep shrink-0" />
            <select
              className="bg-transparent text-sm font-bold text-brand-ink outline-none cursor-pointer"
              value={conductorFiltro}
              onChange={(e) => setConductorFiltro(e.target.value)}
            >
              <option value="todos">Todos los conductores</option>
              {detalle.map((d) => (
                <option key={d.conductor} value={d.conductor}>
                  {d.conductor} ({d.total})
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {detalle.length === 0 ? (
        <div className="rounded-3xl bg-white ring-1 ring-brand-ink/10 shadow-sm px-6 py-16 text-center">
          <div className="mx-auto grid place-items-center size-16 rounded-2xl bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/30 mb-4">
            <MdInbox className="text-3xl" />
          </div>
          <p className="text-lg font-extrabold text-brand-ink">No hay conductores en ruta</p>
          <p className="text-sm text-brand-ink/50 mt-1">
            Aquí aparecerán los conductores con solicitudes en tránsito o tránsito parcial.
          </p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-3xl bg-white ring-1 ring-brand-ink/10 shadow-sm px-6 py-12 text-center">
          <div className="mx-auto grid place-items-center size-14 rounded-2xl bg-brand-cyan/15 text-brand-deep ring-1 ring-brand-cyan/30 mb-3">
            <MdFilterList className="text-2xl" />
          </div>
          <p className="text-base font-extrabold text-brand-ink">Sin coincidencias</p>
          <p className="text-sm text-brand-ink/50 mt-1">Ajusta la búsqueda o el conductor seleccionado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtrados.map((d) => (
            <div key={d.conductor} className="rounded-2xl bg-white ring-1 ring-brand-ink/10 shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3.5 bg-gradient-to-r from-brand-navy to-brand-deep">
                <span className="grid place-items-center size-10 rounded-full bg-brand-cyan/20 ring-1 ring-brand-cyan/40 text-brand-cyan font-extrabold text-sm shrink-0">
                  {initials(d.conductor)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-white font-extrabold text-sm sm:text-base truncate inline-flex items-center gap-2">
                    <MdPerson className="text-brand-cyan shrink-0" />
                    {d.conductor}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {d.vehiculo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-brand-mist">
                        <MdLocalShipping className="text-brand-cyan" />
                        {d.vehiculo}
                      </span>
                    )}
                    {d.placa && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-brand-mist">
                        <MdTag className="text-brand-cyan" />
                        {d.placa}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-cyan/15 px-2.5 py-0.5 text-[11px] font-extrabold text-brand-cyan">
                      {d.total} {d.total === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPlanillaAbierta(d.conductor)}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-4 py-2 text-xs sm:text-sm font-extrabold text-brand-ink hover:brightness-105 transition shrink-0"
                >
                  <MdAssignment className="text-base" />
                  Ver planilla
                </button>
              </div>

              {d.total === 0 ? (
                <p className="px-5 py-5 text-sm text-brand-ink/50 text-center">
                  Sin pedidos en la planilla. Ábrela para agregar filas.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-brand-mist/60 text-brand-ink/60">
                        <th className="px-4 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide">Cliente</th>
                        <th className="px-4 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide">
                          <span className="inline-flex items-center gap-1"><MdPlace /> Zona</span>
                        </th>
                        <th className="px-4 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide">
                          <span className="inline-flex items-center gap-1"><MdCategory /> Tipo</span>
                        </th>
                        <th className="px-4 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.filas.map((s) => (
                        <tr key={s.id} className="border-t border-brand-ink/5">
                          <td className="px-4 py-2.5 font-semibold text-brand-ink">{s.cliente || '—'}</td>
                          <td className="px-4 py-2.5 text-brand-ink/80">{s.zona || '—'}</td>
                          <td className="px-4 py-2.5 text-brand-ink/80">{s.tipoSolicitud || '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${getBadgeColor(s.estado)}`}>
                              {s.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {d.extras.map((f) => (
                        <tr key={f.key} className="border-t border-brand-ink/5 bg-amber-50/40">
                          <td className="px-4 py-2.5 font-semibold text-brand-ink">{f.cliente || '—'}</td>
                          <td className="px-4 py-2.5 text-brand-ink/80">{f.zona || '—'}</td>
                          <td className="px-4 py-2.5 text-brand-ink/80">{f.tipoSolicitud || '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-700">
                              Manual {f.id ? `· ${f.id}` : ''}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <PlanillaModal
        open={Boolean(planillaAbierta)}
        conductor={planillaAbierta}
        solicitudes={solicitudes}
        onClose={cerrarModal}
      />
    </div>
  )
}
