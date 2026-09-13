import { useEffect, useState } from 'react'
import { RiSteering2Line } from 'react-icons/ri'
import { MdClose, MdCheckCircle, MdTag, MdCheck, MdLocalShipping, MdEdit } from 'react-icons/md'
import { nombreDeAsignado } from '../../../Home/Components/solicitudesStore.js'

const CONDUCTORES = ['Reinel Peña', 'Robert', 'Diego Peña', 'Elite', 'Otro']

const OPCION_OTRO = 'Otro'

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function AsignarConductorModal({ solicitud, open, onClose, onUpdate }) {
  const conductor = nombreDeAsignado(solicitud?.conductor)
  const [seleccion, setSeleccion] = useState('')
  const [otroNombre, setOtroNombre] = useState('')

  useEffect(() => {
    if (open) setSeleccion(conductor)
  }, [open, conductor])

  if (!open || !solicitud) return null

  const isConductorActualmente = (n) => n === conductor
  const isSeleccion = (n) => n === seleccion
  const enTransitoParcial = solicitud.estado === 'En Tránsito Parcial'
  const enTransito = solicitud.estado === 'En Tránsito'
  const nombreColor = enTransitoParcial ? 'bg-yellow-500 text-yellow-900' : enTransito ? 'bg-purple-600 text-white' : 'bg-indigo-600 text-white'
  const iconoColor = enTransitoParcial ? 'text-yellow-500' : enTransito ? 'text-purple-500' : 'text-indigo-400'
  const esOtro = seleccion === OPCION_OTRO
  const nombreFinal = esOtro && otroNombre.trim() ? otroNombre.trim() : seleccion

  const handleSelect = (n) => {
    if (n === conductor) return
    setSeleccion(n)
    if (n !== OPCION_OTRO) setOtroNombre('')
  }

  const handleSave = () => {
    if (!seleccion || seleccion === conductor || (esOtro && !otroNombre.trim())) return
    onUpdate(solicitud.id, { conductor: nombreFinal })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-md rounded-2xl shadow-2xl animate-scaleIn max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Asignar conductor"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <RiSteering2Line className="text-brand-cyan text-lg" />
            </span>
            ASIGNAR CONDUCTOR
          </h3>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-cyan/15 ring-1 ring-brand-cyan/40 text-brand-cyan px-2.5 sm:px-3 py-1 text-[10px] sm:text-sm font-bold tracking-wide select-none shadow-[0_0_14px_rgba(0,229,255,0.25)]">
              <MdTag className="text-xs sm:text-sm" />
              {solicitud.id}
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

        {/* Lista de conductores */}
        <div className="p-4 sm:p-6 overflow-y-auto">
          <p className="text-xs font-extrabold text-brand-deep uppercase tracking-wide mb-3">
            Selecciona el conductor para la entrega
          </p>
          <div className="space-y-1.5">
            {CONDUCTORES.map((n) => {
              const actual = isConductorActualmente(n)
              const sel = isSeleccion(n)
              const esOtro = n === OPCION_OTRO
              return (
                <div key={n}>
                  <button
                    type="button"
                    onClick={() => handleSelect(n)}
                    disabled={actual}
                    title={actual ? 'Este conductor ya está asignado' : `Asignar a ${n}`}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-brand-deep transition-all ${
                      actual
                        ? 'bg-indigo-100 ring-1 ring-indigo-400/50 cursor-not-allowed'
                        : sel
                          ? 'bg-indigo-100 ring-2 ring-indigo-400/60'
                          : 'bg-brand-mist/40 hover:bg-indigo-100/70 hover:ring-1 hover:ring-indigo-400/40'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5 min-w-0">
                      <span className={`grid place-items-center size-8 shrink-0 rounded-full ${nombreColor} text-xs font-extrabold`}>
                        {esOtro ? <MdEdit /> : initials(n)}
                      </span>
                      <span className="truncate capitalize">{n}</span>
                    </span>
                    {actual ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700">
                        <MdCheck className="text-indigo-500" /> Conductor
                      </span>
                    ) : (
                      <MdLocalShipping className={`shrink-0 ${iconoColor}`} />
                    )}
                  </button>
                  {esOtro && sel && (
                    <div className="mt-1.5 rounded-xl bg-indigo-50/80 border border-indigo-300/50 p-3 animate-fadeIn">
                      <label className="block text-[11px] font-extrabold text-indigo-700 uppercase tracking-wide mb-2">
                        Nombre del conductor que va
                      </label>
                      <input
                        type="text"
                        value={otroNombre}
                        onChange={(e) => setOtroNombre(e.target.value)}
                        placeholder="Escribe el nombre del conductor…"
                        className="w-full rounded-xl border border-indigo-300/60 bg-white px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink/40 shadow-sm focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Botones */}
        <div className="px-4 sm:px-6 py-4 border-t border-brand-ink/10 shrink-0 flex items-center justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full bg-brand-ink/10 px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-semibold text-brand-ink hover:bg-brand-ink/20 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!seleccion || seleccion === conductor || (esOtro && !otroNombre.trim())}
            className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <span className="grid place-items-center size-6 rounded-full bg-brand-deep/10 text-brand-deep">
              <MdCheckCircle className="text-base" />
            </span>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}