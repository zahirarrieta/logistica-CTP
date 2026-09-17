import { MdDeleteOutline, MdClose, MdWarning } from 'react-icons/md'

export default function ConfirmarEliminarModal({ solicitud, open, onClose, onConfirm }) {
  if (!open || !solicitud) return null

  return (
    <div
      className="fixed inset-0 z-[1100] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-sm rounded-2xl shadow-2xl animate-scaleIn overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 grid place-items-center size-8 rounded-full text-brand-ink/50 hover:bg-brand-ink/10 hover:text-brand-ink transition-colors"
        >
          <MdClose className="text-lg" />
        </button>

        <div className="px-6 pt-6 pb-4 text-center">
          <span className="mx-auto grid place-items-center size-14 rounded-full bg-brand-navy/10 text-brand-deep mb-4">
            <MdDeleteOutline className="text-3xl" />
          </span>
          <h3 className="text-lg font-extrabold text-brand-ink mb-1">Eliminar solicitud</h3>
          <p className="text-sm text-brand-ink/60 leading-relaxed">
            Se eliminará <span className="font-bold text-brand-deep">{solicitud.id}</span> de forma permanente.
            Esta acción no se puede deshacer.
          </p>
        </div>

        <div className="flex items-center gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border-2 border-brand-ink/15 text-brand-ink font-bold py-2.5 text-sm hover:bg-brand-ink/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(solicitud)
              onClose()
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-navy text-white font-bold py-2.5 text-sm hover:bg-brand-deep transition-colors"
          >
            <MdWarning className="text-base" />
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}
