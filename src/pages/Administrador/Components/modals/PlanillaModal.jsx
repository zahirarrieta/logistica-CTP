import { useEffect, useMemo, useRef, useState } from 'react'
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
  MdPersonOutline,
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
const ESTADOS_ENTREGA = ['Entregado', 'Entregado Parcial']

function resultadoDe(estado) {
  if (ESTADOS_ENTREGA.includes(estado)) return estado
  if (ESTADOS_TRANSITO.includes(estado)) return 'Pendiente por entregar'
  return estado || 'Pendiente'
}

function claseResultado(fila) {
  if (fila.manual) return 'bg-brand-mist text-brand-deep'
  if (fila.estado === 'Entregado' || fila.estado === 'Entregado Parcial') {
    return 'bg-emerald-100 text-emerald-700'
  }
  if (ESTADOS_TRANSITO.includes(fila.estado)) return 'bg-amber-100 text-amber-700'
  return getBadgeColor(fila.estado)
}

const FILA_VACIA = { id: '', solicitante: '', cliente: '', zona: '', tipoSolicitud: '', observaciones: '' }

function formatFecha(iso) {
  if (!iso) return new Date().toLocaleDateString('es-CO')
  const partes = String(iso).split('-').map(Number)
  const dt = partes.length === 3 && partes.every(Boolean)
    ? new Date(partes[0], partes[1] - 1, partes[2])
    : new Date(iso)
  if (Number.isNaN(dt.getTime())) return String(iso)
  return dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function Dato({ icon, label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-ink/50">
        {icon}
        {label}
      </span>
      <span className="rounded-lg border border-brand-ink/10 bg-brand-mist/40 px-2.5 py-1.5 text-sm font-semibold text-brand-ink print:bg-transparent">
        {value || '—'}
      </span>
    </div>
  )
}

const celdaInput =
  'w-full bg-transparent text-sm outline-none placeholder:text-brand-ink/30 focus:bg-brand-cyan/5 rounded px-1'

export default function PlanillaModal({ conductor, solicitudes = [], open, onClose }) {
  const [planilla, setPlanilla] = useState(() => getPlanilla(conductor))
  const [generando, setGenerando] = useState(false)
  const [capturando, setCapturando] = useState(false)
  const hojaRef = useRef(null)

  useEffect(() => {
    if (!open || !conductor) return
    const siguiente = getPlanilla(conductor)
    if (!siguiente.fecha) siguiente.fecha = fechaHoy()
    setPlanilla(siguiente)
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
    // Incluye lo que va en ruta (tránsito) y, si la planilla es de hoy, lo que ya
    // se entregó: así al cierre de la tarde se ve qué quedó sin entregar.
    const esHoy = planilla.fecha === fechaHoy()
    const incluidas = delConductor
      .filter(
        (s) =>
          ESTADOS_TRANSITO.includes(s.estado) ||
          (esHoy && ESTADOS_ENTREGA.includes(s.estado)) ||
          agregadas.has(s.id)
      )
      .filter((s) => !ocultas.has(s.id))
      .map((s) => ({
        key: s.id,
        manual: false,
        id: s.id,
        solicitante: s.nombreCompleto || '',
        cliente: s.cliente || '',
        zona: s.zona || '',
        tipoSolicitud: s.tipoSolicitud || '',
        observaciones: obs[s.id] ?? s.observaciones ?? '',
        estado: s.estado,
        resultado: resultadoDe(s.estado),
      }))
    const extra = (planilla.filasExtra || []).map((f) => ({ ...f, manual: true, resultado: 'Manual' }))
    return [...incluidas, ...extra]
  }, [solicitudes, conductor, planilla])

  const resumenCierre = useMemo(() => {
    const noManual = filas.filter((f) => !f.manual)
    const entregados = noManual.filter((f) => ESTADOS_ENTREGA.includes(f.estado)).length
    const pendientes = noManual.filter((f) => ESTADOS_TRANSITO.includes(f.estado))
    const total = filas.length
    return { total, entregados, pendientes }
  }, [filas])

  const datosVehiculo = useMemo(() => {
    const delConductor = solicitudes.filter((s) => nombreDeAsignado(s.conductor) === conductor)
    const base = delConductor.find((s) => s.vehiculo || s.placa) || {}
    return { vehiculo: base.vehiculo || '', placa: base.placa || '' }
  }, [solicitudes, conductor])

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
      setCapturando(true)
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      await descargarPlanillaPdf({ elemento: hojaRef.current, conductor, fecha: planilla.fecha })
    } catch (err) {
      window.alert(`No se pudo generar el PDF: ${err?.message || 'error desconocido'}`)
    } finally {
      setCapturando(false)
      setGenerando(false)
    }
  }
  const handlePrint = () => window.print()

  const soloLectura = capturando

  return (
    <div
      className="planilla-overlay fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center px-2 sm:px-4 py-4 sm:py-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="planilla-dialog relative bg-white text-brand-ink w-full max-w-6xl rounded-2xl shadow-2xl animate-scaleIn my-auto"
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
          {/* Hoja imprimible / exportable */}
          <div ref={hojaRef} id="planilla-print" className="planilla-sheet rounded-xl border border-brand-ink/15 bg-white p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b-2 border-brand-cyan pb-3 mb-4">
              <img src="/CTPM.png" alt="CTP" className="h-12 sm:h-16 w-auto object-contain shrink-0" />
              <div className="text-center min-w-0">
                <p className="text-lg sm:text-xl font-extrabold text-brand-navy uppercase tracking-wide">Planilla de salida</p>
                <p className="text-[11px] font-bold uppercase tracking-widest text-brand-deep/70">CTP Logística · Control de entregas</p>
              </div>
              <img src="/Principal/PEDRO.png" alt="Pedro" className="h-14 sm:h-20 w-auto object-contain shrink-0" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <Dato icon={<MdPerson />} label="Conductor" value={conductor} />
              <Dato icon={<MdLocalShipping />} label="Vehículo / Tipo" value={datosVehiculo.vehiculo} />
              <Dato icon={<MdTag />} label="Placa" value={datosVehiculo.placa} />
              <Dato icon={<MdEvent />} label="Fecha" value={formatFecha(planilla.fecha)} />
            </div>

            <div className={soloLectura ? '' : 'overflow-x-auto'}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-deep text-white">
                    <th className="border border-brand-deep/30 px-2 py-1.5 text-center font-bold w-8">#</th>
                    <th className="border border-brand-deep/30 px-2 py-1.5 text-left font-bold w-28">ID</th>
                    <th className="border border-brand-deep/30 px-2 py-1.5 text-left font-bold w-40">Solicitante</th>
                    <th className="border border-brand-deep/30 px-2 py-1.5 text-left font-bold w-44">Cliente</th>
                    <th className="border border-brand-deep/30 px-2 py-1.5 text-left font-bold w-32">Zona</th>
                    <th className="border border-brand-deep/30 px-2 py-1.5 text-left font-bold w-36">Tipo de solicitud</th>
                    <th className="border border-brand-deep/30 px-2 py-1.5 text-left font-bold w-36">Resultado</th>
                    <th className="border border-brand-deep/30 px-2 py-1.5 text-left font-bold">Observaciones</th>
                    {!soloLectura && <th className="border border-brand-deep/30 px-2 py-1.5 text-center font-bold w-10 print:hidden">—</th>}
                  </tr>
                </thead>
                <tbody>
                  {filas.length === 0 ? (
                    <tr>
                      <td colSpan={soloLectura ? 8 : 9} className="border border-brand-ink/10 px-3 py-6 text-center text-brand-ink/50 font-semibold">
                        No hay pedidos en esta planilla. Agrega filas o solicitudes.
                      </td>
                    </tr>
                  ) : (
                    filas.map((f, i) => (
                      <tr key={f.key} className={i % 2 === 0 ? 'bg-white' : 'bg-brand-cyan/5'}>
                        <td className="border border-brand-ink/10 px-2 py-1.5 text-center font-bold text-brand-ink/60">{i + 1}</td>
                        <td className="border border-brand-ink/10 px-1.5 py-1">
                          {f.manual && !soloLectura ? (
                            <input
                              className={`${celdaInput} font-extrabold text-brand-deep uppercase`}
                              value={f.id}
                              placeholder="CTPLOG-"
                              onChange={(e) => editarFilaManual(f.key, 'id', e.target.value)}
                            />
                          ) : (
                            <span className="px-1 font-extrabold text-brand-deep">{f.id || '—'}</span>
                          )}
                        </td>
                        <td className="border border-brand-ink/10 px-1.5 py-1">
                          {f.manual && !soloLectura ? (
                            <input
                              className={`${celdaInput} font-semibold`}
                              value={f.solicitante}
                              placeholder="Solicitante"
                              onChange={(e) => editarFilaManual(f.key, 'solicitante', e.target.value)}
                            />
                          ) : (
                            <span className="px-1 font-semibold text-brand-ink">{f.solicitante || '—'}</span>
                          )}
                        </td>
                        <td className="border border-brand-ink/10 px-1.5 py-1 max-w-44 overflow-hidden">
                          {f.manual && !soloLectura ? (
                            <input
                              className={`${celdaInput} font-semibold`}
                              value={f.cliente}
                              placeholder="Cliente"
                              onChange={(e) => editarFilaManual(f.key, 'cliente', e.target.value)}
                            />
                          ) : (
                            <span className="block px-1 font-semibold text-brand-ink truncate" title={f.cliente || ''}>
                              {f.cliente || '—'}
                            </span>
                          )}
                        </td>
                        <td className="border border-brand-ink/10 px-1.5 py-1">
                          {f.manual && !soloLectura ? (
                            <input
                              className={celdaInput}
                              value={f.zona}
                              placeholder="Zona"
                              onChange={(e) => editarFilaManual(f.key, 'zona', e.target.value)}
                            />
                          ) : (
                            <span className="px-1 text-brand-ink/80">{f.zona || '—'}</span>
                          )}
                        </td>
                        <td className="border border-brand-ink/10 px-1.5 py-1">
                          {f.manual && !soloLectura ? (
                            <input
                              className={celdaInput}
                              value={f.tipoSolicitud}
                              placeholder="Tipo"
                              onChange={(e) => editarFilaManual(f.key, 'tipoSolicitud', e.target.value)}
                            />
                          ) : (
                            <span className="px-1 text-brand-ink/80">{f.tipoSolicitud || '—'}</span>
                          )}
                        </td>
                        <td className="border border-brand-ink/10 px-1.5 py-1">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap ${claseResultado(f)}`}>
                            {f.resultado}
                          </span>
                        </td>
                        <td className="border border-brand-ink/10 px-1.5 py-1">
                          {soloLectura ? (
                            <span className="px-1 text-brand-ink/80">{f.observaciones || '—'}</span>
                          ) : (
                            <input
                              className={`${celdaInput} text-brand-ink/80`}
                              value={f.observaciones}
                              placeholder="Observación…"
                              onChange={(e) => (f.manual ? editarFilaManual(f.key, 'observaciones', e.target.value) : editarObservacion(f.id, e.target.value))}
                            />
                          )}
                        </td>
                        {!soloLectura && (
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
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!soloLectura && filas.some((f) => !f.manual && f.estado) && (
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
              {soloLectura ? (
                <p className="mt-1 min-h-10 whitespace-pre-wrap rounded-lg border border-brand-ink/15 px-2.5 py-1.5 text-sm text-brand-ink/80">
                  {planilla.observaciones || 'Sin observaciones.'}
                </p>
              ) : (
                <textarea
                  rows={2}
                  className="mt-1 w-full resize-y rounded-lg border border-brand-ink/15 bg-white px-2.5 py-1.5 text-sm font-normal text-brand-ink outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 transition"
                  value={planilla.observaciones || ''}
                  onChange={(e) => actualizar({ observaciones: e.target.value })}
                  placeholder="Novedades, instrucciones o pendientes de la ruta…"
                />
              )}
            </div>

            <div className="mt-5 border-t-2 border-brand-deep pt-3">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-brand-navy">
                Cierre de la jornada
              </p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-brand-ink/10 bg-brand-mist/40 px-3 py-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-brand-ink/50">Pedidos en planilla</p>
                  <p className="text-xl font-extrabold text-brand-ink">{resumenCierre.total}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-600">Entregados</p>
                  <p className="text-xl font-extrabold text-emerald-700">{resumenCierre.entregados}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-600">Pendientes por entregar</p>
                  <p className="text-xl font-extrabold text-amber-700">{resumenCierre.pendientes.length}</p>
                </div>
              </div>
              {resumenCierre.pendientes.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-700">
                    Hizo falta por entregar ({resumenCierre.pendientes.length}):
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {resumenCierre.pendientes.map((f) => (
                      <li key={f.key} className="text-xs font-semibold text-amber-900 leading-snug">
                        <span className="font-extrabold">{f.id || '—'}</span>
                        {' · '}{f.cliente || 'Sin cliente'}
                        {f.zona ? ` · ${f.zona}` : ''}
                        {f.observaciones ? ` · ${f.observaciones}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {resumenCierre.entregados === resumenCierre.total && resumenCierre.total > 0 && (
                <p className="mt-2 text-xs font-extrabold uppercase tracking-wide text-emerald-700">
                  Jornada completa: todos los pedidos de la planilla fueron entregados.
                </p>
              )}
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
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-ink/50 sm:ml-auto">
              <MdPersonOutline />
              Los datos de conductor, vehículo, placa y fecha se toman automáticamente de la asignación.
            </span>
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
