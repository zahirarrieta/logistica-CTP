import { useEffect, useMemo, useState } from 'react'
import {
  MdClose,
  MdPrint,
  MdPictureAsPdf,
  MdRestartAlt,
  MdAddCircleOutline,
  MdDeleteOutline,
  MdDescription,
  MdLocalShipping,
  MdTag,
  MdPerson,
  MdEvent,
  MdNotes,
} from 'react-icons/md'
import { nombreDeAsignado } from '../../../Home/Components/solicitudesStore.js'
import { getBadgeColor } from '../../../Home/Components/estadoColors.js'
import { descargarPlanillaPdf } from '../../../../services/planillaPdf.js'
import {
  getPlanilla,
  guardarPlanilla,
  resetPlanilla,
  nuevaClaveFila,
  fechaHoy,
} from '../planillaStore.js'

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']
const VEHICULOS = ['Moto', 'Carro', 'Camioneta']

const FILA_VACIA = { id: '', cliente: '', zona: '', tipoSolicitud: '', observaciones: '' }

function Campo({ icon, label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-ink/50">
        {icon}
        {label}
      </span>
      {children}
    </label>
  )
}

const inputBase =
  'w-full rounded-lg border border-brand-ink/15 bg-white px-2.5 py-1.5 text-sm font-semibold text-brand-ink outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 transition print:border-brand-ink/25'

export default function PlanillaModal({ conductor, solicitudes = [], open, onClose }) {
  const [planilla, setPlanilla] = useState(() => getPlanilla(conductor))
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    if (!open || !conductor) return
    const siguiente = getPlanilla(conductor)
    const base = solicitudes.find((s) => nombreDeAsignado(s.conductor) === conductor && (s.vehiculo || s.placa))
    if (!siguiente.vehiculo) siguiente.vehiculo = base?.vehiculo || ''
    if (!siguiente.placa) siguiente.placa = base?.placa || ''
    if (!siguiente.fecha) siguiente.fecha = fechaHoy()
    setPlanilla(siguiente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conductor])

  const actualizar = (patch) => {
    setPlanilla((prev) => {
      const next = { ...prev, ...patch }
      guardarPlanilla(conductor, next)
      return next
    })
  }

  const filas = useMemo(() => {
    const ocultas = new Set(planilla.filasOcultas || [])
    const agregadas = new Set(planilla.filasAgregadas || [])
    const obs = planilla.observacionesFila || {}
    const delConductor = solicitudes.filter((s) => nombreDeAsignado(s.conductor) === conductor)
    const incluidas = delConductor
      .filter((s) => (ESTADOS_TRANSITO.includes(s.estado) || agregadas.has(s.id)) && !ocultas.has(s.id))
      .map((s) => ({
        key: s.id,
        manual: false,
        id: s.id,
        cliente: s.cliente || '',
        zona: s.zona || '',
        tipoSolicitud: s.tipoSolicitud || '',
        observaciones: obs[s.id] ?? s.observaciones ?? '',
        estado: s.estado,
      }))
    const extra = (planilla.filasExtra || []).map((f) => ({ ...f, manual: true }))
    return [...incluidas, ...extra]
  }, [solicitudes, conductor, planilla])

  if (!open || !conductor) return null

  const idsIncluidos = new Set(filas.map((f) => f.id).filter(Boolean))
  const candidatas = solicitudes.filter((s) => !idsIncluidos.has(s.id))

  const agregarSolicitud = (id) => {
    if (!id) return
    const filasAgregadas = (planilla.filasAgregadas || []).includes(id)
      ? planilla.filasAgregadas
      : [...(planilla.filasAgregadas || []), id]
    actualizar({ filasAgregadas, filasOcultas: (planilla.filasOcultas || []).filter((x) => x !== id) })
  }

  const quitarFila = (fila) => {
    if (fila.manual) {
      actualizar({ filasExtra: (planilla.filasExtra || []).filter((f) => f.key !== fila.key) })
      return
    }
    const enAgregadas = (planilla.filasAgregadas || []).includes(fila.id)
    if (enAgregadas) {
      actualizar({ filasAgregadas: planilla.filasAgregadas.filter((x) => x !== fila.id) })
    } else {
      actualizar({ filasOcultas: [...(planilla.filasOcultas || []), fila.id] })
    }
  }

  const agregarFilaManual = () => {
    actualizar({ filasExtra: [...(planilla.filasExtra || []), { key: nuevaClaveFila(), ...FILA_VACIA }] })
  }

  const editarFilaManual = (key, campo, valor) => {
    actualizar({ filasExtra: (planilla.filasExtra || []).map((f) => (f.key === key ? { ...f, [campo]: valor } : f)) })
  }

  const editarObservacion = (id, valor) => {
    actualizar({ observacionesFila: { ...(planilla.observacionesFila || {}), [id]: valor } })
  }

  const handleReset = () => {
    const ok = window.confirm('¿Restablecer esta planilla? Se quitarán filas agregadas, observaciones y cambios guardados.')
    if (!ok) return
    const limpia = resetPlanilla(conductor)
    limpia.fecha = fechaHoy()
    setPlanilla(limpia)
  }

  const handlePdf = async () => {
    try {
      setGenerando(true)
      await descargarPlanillaPdf({ ...planilla, filas })
    } catch (err) {
      window.alert(`No se pudo generar el PDF: ${err?.message || 'error desconocido'}`)
    } finally {
      setGenerando(false)
    }
  }
  const handlePrint = () => window.print()

  return (
    <div
      className="planilla-overlay fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center px-2 sm:px-4 py-4 sm:py-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="planilla-dialog relative bg-white text-brand-ink w-full max-w-5xl rounded-2xl shadow-2xl animate-scaleIn my-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Planilla de salida"
      >
        {/* Barra superior */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 rounded-t-2xl">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2 min-w-0">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shrink-0">
              <MdDescription className="text-brand-cyan text-lg" />
            </span>
            <span className="truncate">PLANILLA DE SALIDA</span>
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-brand-cyan/15 ring-1 ring-brand-cyan/40 text-brand-cyan px-3 py-1 text-xs font-bold tracking-wide">
              <MdPerson className="text-sm" />
              {conductor}
            </span>
            <button
              aria-label="Cerrar"
              onClick={onClose}
              className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            >
              <MdClose className="text-lg" />
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-6">
          {/* Hoja imprimible */}
          <div id="planilla-print" className="planilla-sheet rounded-xl border border-brand-ink/15 bg-white p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-brand-cyan pb-3 mb-4">
              <div>
                <p className="text-lg sm:text-xl font-extrabold text-brand-navy uppercase tracking-wide">Planilla de salida</p>
                <p className="text-[11px] font-bold uppercase tracking-widest text-brand-deep/70">CTP Logística · Control de entregas</p>
              </div>
              <span className="text-xs font-bold text-brand-ink/60">{filas.length} {filas.length === 1 ? 'pedido' : 'pedidos'}</span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <Campo icon={<MdPerson />} label="Conductor">
                <input className={inputBase} value={conductor} readOnly />
              </Campo>
              <Campo icon={<MdLocalShipping />} label="Vehículo / Tipo">
                <select className={inputBase} value={planilla.vehiculo || ''} onChange={(e) => actualizar({ vehiculo: e.target.value })}>
                  <option value="">Sin especificar</option>
                  {VEHICULOS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </Campo>
              <Campo icon={<MdTag />} label="Placa">
                <input
                  className={`${inputBase} uppercase`}
                  value={planilla.placa || ''}
                  onChange={(e) => actualizar({ placa: e.target.value.toUpperCase() })}
                  placeholder="ABC123"
                />
              </Campo>
              <Campo icon={<MdEvent />} label="Fecha">
                <input type="date" className={inputBase} value={planilla.fecha || ''} onChange={(e) => actualizar({ fecha: e.target.value })} />
              </Campo>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-deep text-white">
                    <th className="border border-brand-deep/30 px-2 py-1.5 text-center font-bold w-8">#</th>
                    <th className="border border-brand-deep/30 px-2 py-1.5 text-left font-bold w-28">ID</th>
                    <th className="border border-brand-deep/30 px-2 py-1.5 text-left font-bold">Cliente</th>
                    <th className="border border-brand-deep/30 px-2 py-1.5 text-left font-bold w-32">Zona</th>
                    <th className="border border-brand-deep/30 px-2 py-1.5 text-left font-bold w-36">Tipo de solicitud</th>
                    <th className="border border-brand-deep/30 px-2 py-1.5 text-left font-bold">Observaciones</th>
                    <th className="border border-brand-deep/30 px-2 py-1.5 text-center font-bold w-10 print:hidden">—</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="border border-brand-ink/10 px-3 py-6 text-center text-brand-ink/50 font-semibold">
                        No hay pedidos en esta planilla. Agrega filas o solicitudes.
                      </td>
                    </tr>
                  ) : (
                    filas.map((f, i) => (
                      <tr key={f.key} className={i % 2 === 0 ? 'bg-white' : 'bg-brand-cyan/5'}>
                        <td className="border border-brand-ink/10 px-2 py-1.5 text-center font-bold text-brand-ink/60">{i + 1}</td>
                        <td className="border border-brand-ink/10 px-1.5 py-1">
                          {f.manual ? (
                            <input
                              className="w-full bg-transparent text-xs font-bold text-brand-deep uppercase outline-none"
                              value={f.id}
                              placeholder="CTPLOG-"
                              onChange={(e) => editarFilaManual(f.key, 'id', e.target.value)}
                            />
                          ) : (
                            <span className="font-extrabold text-brand-deep">{f.id}</span>
                          )}
                        </td>
                        <td className="border border-brand-ink/10 px-1.5 py-1">
                          {f.manual ? (
                            <input
                              className="w-full bg-transparent text-sm font-semibold outline-none"
                              value={f.cliente}
                              placeholder="Cliente"
                              onChange={(e) => editarFilaManual(f.key, 'cliente', e.target.value)}
                            />
                          ) : (
                            <span className="font-semibold text-brand-ink">{f.cliente || '—'}</span>
                          )}
                        </td>
                        <td className="border border-brand-ink/10 px-1.5 py-1">
                          {f.manual ? (
                            <input
                              className="w-full bg-transparent text-sm outline-none"
                              value={f.zona}
                              placeholder="Zona"
                              onChange={(e) => editarFilaManual(f.key, 'zona', e.target.value)}
                            />
                          ) : (
                            <span className="text-brand-ink/80">{f.zona || '—'}</span>
                          )}
                        </td>
                        <td className="border border-brand-ink/10 px-1.5 py-1">
                          {f.manual ? (
                            <input
                              className="w-full bg-transparent text-sm outline-none"
                              value={f.tipoSolicitud}
                              placeholder="Tipo"
                              onChange={(e) => editarFilaManual(f.key, 'tipoSolicitud', e.target.value)}
                            />
                          ) : (
                            <span className="text-brand-ink/80">{f.tipoSolicitud || '—'}</span>
                          )}
                        </td>
                        <td className="border border-brand-ink/10 px-1.5 py-1">
                          <input
                            className="w-full bg-transparent text-sm text-brand-ink/80 outline-none"
                            value={f.observaciones}
                            placeholder="Observación…"
                            onChange={(e) => (f.manual ? editarFilaManual(f.key, 'observaciones', e.target.value) : editarObservacion(f.id, e.target.value))}
                          />
                        </td>
                        <td className="border border-brand-ink/10 px-1 py-1 text-center print:hidden">
                          <button
                            type="button"
                            onClick={() => quitarFila(f)}
                            title="Quitar de la planilla"
                            className="grid place-items-center size-7 rounded-lg text-red-500 hover:bg-red-50 transition mx-auto"
                          >
                            <MdDeleteOutline />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filas.some((f) => !f.manual && f.estado) && (
              <div className="mt-3 flex flex-wrap gap-1.5 print:hidden">
                {[...new Set(filas.filter((f) => !f.manual).map((f) => f.estado))].map((e) => (
                  <span key={e} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${getBadgeColor(e)}`}>
                    {e}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-5">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-brand-ink/50">
                <MdNotes />
                Observaciones generales
              </p>
              <textarea
                rows={2}
                className={`${inputBase} mt-1 resize-y font-normal`}
                value={planilla.observaciones || ''}
                onChange={(e) => actualizar({ observaciones: e.target.value })}
                placeholder="Novedades, instrucciones o pendientes de la ruta…"
              />
            </div>

            <div className="mt-8 grid grid-cols-2 gap-8 text-[11px] text-brand-ink/60">
              <div className="border-t border-brand-ink/30 pt-1.5">
                <p className="font-bold">Firma del conductor</p>
                <p className="font-semibold text-brand-ink/80">{conductor}</p>
              </div>
              <div className="border-t border-brand-ink/30 pt-1.5">
                <p className="font-bold">Firma despacho / coordinación</p>
              </div>
            </div>
          </div>

          {/* Controles de edición (no se imprimen) */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 print:hidden">
            <label className="inline-flex items-center gap-2 rounded-xl bg-brand-mist/70 ring-1 ring-brand-ink/10 px-3 py-2">
              <MdAddCircleOutline className="text-brand-deep" />
              <span className="text-xs font-bold text-brand-deep uppercase tracking-wide">Agregar solicitud</span>
              <select
                className="bg-white rounded-lg border border-brand-ink/15 px-2 py-1 text-sm font-semibold outline-none focus:border-brand-cyan max-w-[15rem]"
                value=""
                onChange={(e) => agregarSolicitud(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {candidatas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} · {s.cliente || 'sin cliente'}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={agregarFilaManual}
              className="inline-flex items-center gap-2 rounded-xl border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-brand-deep hover:bg-brand-cyan/20 transition"
            >
              <MdAddCircleOutline className="text-base" />
              Fila manual
            </button>
          </div>
        </div>

        {/* Pie de acciones */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-brand-ink/10 px-4 sm:px-6 py-3 print:hidden">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-50 px-4 py-2 text-xs sm:text-sm font-bold text-red-700 hover:bg-red-100 transition"
          >
            <MdRestartAlt className="text-base" />
            Restablecer
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-full border border-brand-ink/15 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-brand-deep hover:bg-brand-mist transition"
          >
            <MdPrint className="text-base" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={handlePdf}
            disabled={generando}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-navy to-brand-deep px-4 py-2 text-xs sm:text-sm font-bold text-white hover:opacity-95 transition disabled:opacity-60 disabled:cursor-wait"
          >
            <MdPictureAsPdf className="text-base text-brand-cyan" />
            {generando ? 'Generando…' : 'Descargar PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
