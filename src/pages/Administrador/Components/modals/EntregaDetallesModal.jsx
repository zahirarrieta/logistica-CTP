import { MdClose, MdDescription } from 'react-icons/md'
import EntregasLista from '../../../../components/EntregasLista.jsx'
import { buscarEntregas } from '../../../../store/solicitudesStore.js'
import Modal from '../../../../components/Modal.jsx'

export default function EntregaDetallesModal({ solicitud, open, onClose }) {
  if (!open || !solicitud) return null

  // Todas las entregas registradas (parcial y final), en orden cronológico.
  const entregas = buscarEntregas(solicitud)
  const varias = entregas.length > 1

  return (
    <Modal
      onClose={onClose}
      overlayClassName="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fadeIn"
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden bg-white shadow-2xl animate-scaleIn max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera */}
        <header className="relative shrink-0 bg-gradient-to-r from-brand-navy to-brand-deep px-4 sm:px-6 py-4 flex items-center gap-3">
          <span className="grid place-items-center size-10 shrink-0 rounded-xl bg-white/10 text-brand-cyan shadow-cyanGlow">
            <MdDescription className="text-xl" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              {varias ? 'Detalles de las entregas' : 'Detalles de la entrega'}
            </h3>
            <p className="text-[11px] sm:text-xs text-white/60 truncate">
              Solicitud{' '}
              <span className="font-bold text-brand-cyan">{solicitud.id}</span>
              {varias && (
                <>
                  {' · '}
                  <span className="font-bold text-brand-cyan">{entregas.length} entregas</span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center size-8 shrink-0 rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
            title="Cerrar"
          >
            <MdClose className="text-lg" />
          </button>
        </header>

        {/* Cuerpo */}
        <div className="p-4 sm:p-6 overflow-y-auto">
          {entregas.length === 0 ? (
            <div className="rounded-xl border border-brand-ink/10 bg-brand-mist/40 px-4 py-6 text-center text-sm text-brand-ink/60">
              Aún no hay una entrega registrada en esta solicitud.
            </div>
          ) : (
            <EntregasLista solicitud={solicitud} entregas={entregas} />
          )}
        </div>

        {/* Pie */}
        <footer className="shrink-0 bg-brand-mist border-t border-brand-ink/10 px-4 sm:px-6 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-full bg-brand-navy text-white text-sm font-bold px-5 py-2.5 hover:bg-brand-deep transition-colors shadow-sm"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </Modal>
  )
}
