import { MdClose, MdNotes } from 'react-icons/md'

export default function ObservacionesModal({ solicitud, open, onClose }) {
  if (!open || !solicitud) return null

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-md rounded-2xl shadow-2xl animate-scaleIn max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Observaciones"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 sticky top-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <MdNotes className="text-brand-cyan" />
            OBSERVACIONES
          </h3>
          <button
            aria-label="Cerrar"
            onClick={onClose}
            className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-ink/10 px-3 py-1 text-xs sm:text-sm font-bold text-brand-deep">{solicitud.id}</span>
            {solicitud.cliente && (
              <span className="rounded-full bg-brand-cyan/15 px-3 py-1 text-xs sm:text-sm font-bold text-brand-deep capitalize">{solicitud.cliente}</span>
            )}
          </div>
          <p className="text-brand-ink/80 leading-relaxed">
            {solicitud.observaciones || '—'}
          </p>
        </div>
      </div>
    </div>
  )
}