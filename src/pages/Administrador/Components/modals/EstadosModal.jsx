import { useState, useEffect, useRef } from 'react'
import { MdClose, MdSave, MdSwapHoriz, MdTag, MdCalendarToday, MdAccessTime, MdPerson, MdEmail, MdAssignmentAdd, MdBusiness, MdPlace, MdAttachFile, MdNotes, MdExpandMore, MdAssignmentInd, MdPersonAdd, MdCheck } from 'react-icons/md'
import { ESTADOS, getBadgeColor, getDotColor } from '../../../Home/Components/estadoColors.js'

const ASIGNADOS = [
  'Juan Andrés Pérez',
  'María Camila Gómez',
  'Carlos Andrés Rodríguez',
  'Ana Sofía Martínez',
  'Luis Fernando Hernández',
  'Laura Daniela Díaz',
  'Andrés Felipe Torres',
]

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-brand-cyan mt-0.5 shrink-0">{icon}</span>
      <span className="text-brand-ink/50 w-24 shrink-0 text-xs uppercase tracking-wide pt-0.5">{label}</span>
      <span className="inline-flex flex-wrap items-center gap-1 rounded-full bg-brand-cyan/10 text-brand-deep px-2.5 py-0.5 text-xs font-bold capitalize">
        {value || '—'}
      </span>
    </div>
  )
}

export default function EstadosModal({ solicitud, open, onClose, onUpdate }) {
  const [estado, setEstado] = useState('Abierto')
  const [asignadoA, setAsignadoA] = useState('')
  const [infoOpen, setInfoOpen] = useState(false)
  const [asignadosOpen, setAsignadosOpen] = useState(false)
  const [estadosOpen, setEstadosOpen] = useState(false)
  const asignadosRef = useRef(null)
  const estadosRef = useRef(null)

  useEffect(() => {
    if (solicitud) {
      setEstado(solicitud.estado || 'Abierto')
      setAsignadoA(solicitud.asignadoA || '')
      setInfoOpen(false)
      setAsignadosOpen(false)
      setEstadosOpen(false)
    }
  }, [solicitud])

  useEffect(() => {
    if (!asignadosOpen && !estadosOpen) return
    const onDocClick = (e) => {
      if (asignadosRef.current && !asignadosRef.current.contains(e.target)) setAsignadosOpen(false)
      if (estadosRef.current && !estadosRef.current.contains(e.target)) setEstadosOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [asignadosOpen, estadosOpen])

  if (!open || !solicitud) return null

  const handleSave = () => {
    onUpdate(solicitud.id, { estado, asignadoA })
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
        aria-label="Cambiar estado y asignación de solicitud"
      >
        {/* Header del modal */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdSwapHoriz className="text-brand-cyan text-lg" />
            </span>
            CAMBIAR ESTADO
          </h3>
          <button
            aria-label="Cerrar"
            onClick={onClose}
            className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* ID de la solicitud */}
          <div className="flex items-center justify-between rounded-xl bg-brand-ink/5 border border-brand-ink/10 px-4 py-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-ink/60 uppercase tracking-wide">
              <MdTag className="text-brand-cyan" />
              Solicitud
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy text-white px-3 py-1 text-xs font-bold">
              {solicitud.id}
            </span>
          </div>

          {/* Card desplegable de información */}
          <div className="overflow-hidden rounded-2xl border border-brand-ink/10 shadow-sm">
            <button
              type="button"
              onClick={() => setInfoOpen(!infoOpen)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-brand-cyan/15 to-brand-cyan/5 text-left transition-colors hover:from-brand-cyan/25 hover:to-brand-cyan/10"
            >
              <span className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-deep">
                <MdPerson className="text-brand-cyan text-lg" />
                Información de la solicitud
              </span>
              <span className="inline-flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${getBadgeColor(estado)}`}>
                  <span className={`size-2 rounded-full ${getDotColor(estado)}`} />
                  {estado}
                </span>
                <MdExpandMore className={`text-xl text-brand-deep/60 shrink-0 transition-transform duration-200 ${infoOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>
            {infoOpen && (
              <div className="px-4 py-3 space-y-1 animate-fadeIn">
                <InfoRow icon={<MdCalendarToday />} label="Fecha" value={solicitud.fechaSubida || solicitud.fecha} />
                <InfoRow icon={<MdAccessTime />} label="Hora" value={solicitud.horaSubida || '—'} />
                <InfoRow icon={<MdPerson />} label="Nombre" value={solicitud.nombreCompleto} />
                <InfoRow icon={<MdEmail />} label="Correo" value={solicitud.correo} />
                <InfoRow icon={<MdAssignmentAdd />} label="Tipo" value={solicitud.tipoSolicitud} />
                <InfoRow icon={<MdBusiness />} label="Cliente" value={solicitud.cliente} />
                <InfoRow icon={<MdPlace />} label="Zona" value={solicitud.zona} />
                <InfoRow icon={<MdAttachFile />} label="Adjuntos" value={solicitud.adjuntos?.length > 0 ? `${solicitud.adjuntos.length} archivo(s)` : '—'} />
                <InfoRow icon={<MdNotes />} label="Observaciones" value={solicitud.observaciones || '—'} />
              </div>
            )}
          </div>

          {/* Asignado a */}
          <div className="rounded-2xl border border-brand-ink/10 bg-white shadow-sm overflow-visible">
            <div className="px-4 pt-3 pb-3">
              <label className="block text-xs font-extrabold text-brand-deep uppercase tracking-wide mb-2 inline-flex items-center gap-1.5">
                <MdAssignmentInd className="text-brand-cyan text-base" />
                Asignado a
              </label>
              <div className="relative" ref={asignadosRef}>
                <button
                  type="button"
                  onClick={() => setAsignadosOpen(!asignadosOpen)}
                  className="w-full flex items-center justify-between gap-2 rounded-xl border-2 border-brand-ink/10 bg-brand-mist/40 px-3 py-2.5 text-sm font-semibold text-brand-ink focus:outline-none focus:border-brand-cyan/60 transition-colors"
                >
                  {asignadoA ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-brand-deep/10 text-brand-deep px-3 py-1 text-xs font-bold">
                      <span className="grid place-items-center size-5 rounded-full bg-brand-deep text-white text-[10px] font-extrabold">
                        {initials(asignadoA)}
                      </span>
                      {asignadoA}
                      <span className="text-brand-cyan"><MdCheck /></span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-brand-ink/40">
                      <MdPersonAdd className="text-lg" />
                      Seleccionar persona…
                    </span>
                  )}
                  <MdExpandMore className={`text-xl text-brand-deep/60 shrink-0 transition-transform duration-200 ${asignadosOpen ? 'rotate-180' : ''}`} />
                </button>

                {asignadosOpen && (
                  <div className="absolute left-0 top-full mt-2 w-full z-50 max-h-64 overflow-y-auto rounded-2xl bg-white border border-brand-ink/10 shadow-xl p-2 animate-scaleIn origin-top">
                    {ASIGNADOS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setAsignadoA(n)
                          setAsignadosOpen(false)
                        }}
                        className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                          asignadoA === n ? 'bg-brand-cyan/20' : 'hover:bg-brand-ink/5'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <span className="grid place-items-center size-7 shrink-0 rounded-full bg-brand-deep text-white text-xs font-extrabold">
                            {initials(n)}
                          </span>
                          <span className="truncate">{n}</span>
                        </span>
                        {asignadoA === n && <MdCheck className="text-brand-cyan shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Selección de estado */}
          <div className="rounded-2xl border border-brand-ink/10 bg-white shadow-sm p-4">
            <label className="block text-xs font-extrabold text-brand-deep uppercase tracking-wide mb-2">Cambiar estado a</label>
            <div className="relative" ref={estadosRef}>
              <button
                type="button"
                onClick={() => setEstadosOpen(!estadosOpen)}
                className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${getBadgeColor(estado)} ${
                  estadosOpen ? 'ring-2 ring-brand-deep/40 shadow-sm' : 'hover:brightness-95'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${getDotColor(estado)}`} />
                  {estado}
                </span>
                <MdExpandMore className={`text-lg shrink-0 transition-transform duration-200 ${estadosOpen ? 'rotate-180' : ''}`} />
              </button>

              {estadosOpen && (
                <div className="absolute left-0 top-full mt-2 w-full z-50 max-h-64 overflow-y-auto rounded-2xl bg-white border border-brand-ink/10 shadow-xl p-2 animate-scaleIn origin-top">
                  {ESTADOS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        setEstado(e)
                        setEstadosOpen(false)
                      }}
                      className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-all ${getBadgeColor(e)} ${
                        estado === e ? 'ring-2 ring-brand-deep/40 shadow-sm' : 'hover:brightness-95'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${getDotColor(e)}`} />
                        {e}
                      </span>
                      {estado === e && <MdCheck className="shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Botones */}
          <div className="pt-1 flex items-center justify-end gap-2 sm:gap-3">
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
              className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] hover:-translate-y-0.5 transition-all"
            >
              <MdSave className="text-lg" />
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}