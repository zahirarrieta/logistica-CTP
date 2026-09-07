import { MdClose, MdHistory, MdTag, MdBusiness, MdPlace, MdPerson, MdAccessTime, MdArrowForward } from 'react-icons/md'
import { getBadgeColor, getDotColor } from '../../../Home/Components/estadoColors.js'

export default function HistorialModal({ solicitud, open, onClose }) {
  if (!open || !solicitud) return null

  const historial = Array.isArray(solicitud.historial) ? solicitud.historial : []
  const cambiosEstado = historial.filter((h) => h.campo === 'estado')

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-lg rounded-2xl shadow-2xl animate-scaleIn max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Historial de cambios"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40">
              <MdHistory className="text-brand-cyan text-lg" />
            </span>
            HISTORIAL DE CAMBIOS
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
          {/* Resumen de la solicitud */}
          <div className="rounded-xl bg-brand-ink/5 border border-brand-ink/10 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1 font-bold text-brand-deep"><MdTag className="text-brand-cyan" /> {solicitud.id}</span>
            <span className="inline-flex items-center gap-1 text-brand-ink/70"><MdBusiness className="text-brand-cyan" /> {solicitud.cliente || '—'}</span>
            <span className="inline-flex items-center gap-1 capitalize text-brand-ink/70"><MdPlace className="text-brand-cyan" /> {solicitud.zona || '—'}</span>
          </div>

          {/* Lista de cambiar de estado */}
          {cambiosEstado.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <MdHistory className="text-4xl text-brand-ink/20 mb-2" />
              <p className="text-brand-ink/50 text-sm">Sin cambios de estado registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cambiosEstado.map((h, i) => (
                <div key={i} className="rounded-xl border border-brand-ink/10 bg-white shadow-sm p-3 animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 font-bold text-brand-deep">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${getBadgeColor(h.nuevo)}`}>
                        <span className={`size-1.5 rounded-full ${getDotColor(h.nuevo)}`} />
                        NUEVO
                      </span>
                      <span className="inline-flex items-center gap-1 text-brand-ink/60"><MdAccessTime /> {h.fecha} · {h.hora}</span>
                      <span className="inline-flex items-center gap-1 text-brand-ink/60"><MdPerson /> {h.persona || '—'}</span>
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${getBadgeColor(h.anterior)}`}>
                      <span className={`size-1.5 rounded-full ${getDotColor(h.anterior)}`} />
                      {h.anterior}
                    </span>
                    <MdArrowForward className="text-brand-ink/40" />
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${getBadgeColor(h.nuevo)}`}>
                      <span className={`size-1.5 rounded-full ${getDotColor(h.nuevo)}`} />
                      {h.nuevo}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}