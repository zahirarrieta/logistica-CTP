import { MdClose, MdDescription, MdTag, MdVerified, MdDoneAll, MdEvent } from 'react-icons/md'
import EntregaInfo from '../../../../components/EntregaInfo.jsx'
import { getSoftColor } from '../../../Home/Components/estadoColors.js'
import { safeText, buscarEntrega } from '../../../Home/Components/solicitudesStore.js'

export default function EntregaDetallesModal({ solicitud, open, onClose }) {
  if (!open || !solicitud) return null

  const entrega = buscarEntrega(solicitud)
  const estado = entrega?.nuevo || 'Entregado'
  const soft = getSoftColor(estado)

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
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
              Detalles de la entrega
            </h3>
            <p className="text-[11px] sm:text-xs text-white/60 truncate">
              Solicitud{' '}
              <span className="font-bold text-brand-cyan">{solicitud.id}</span>
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
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
          {!entrega ? (
            <div className="rounded-xl border border-brand-ink/10 bg-brand-mist/40 px-4 py-6 text-center text-sm text-brand-ink/60">
              Aún no hay una entrega registrada en esta solicitud.
            </div>
          ) : (
            <>
              {/* Estado final */}
              <div className={`rounded-2xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 ${soft}`}>
                <span className="grid place-items-center size-11 shrink-0 rounded-full bg-white shadow-sm">
                  {estado === 'Entregado' ? (
                    <MdVerified className="text-2xl text-green-600" />
                  ) : (
                    <MdDoneAll className="text-2xl text-orange-500" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-black tracking-tight">{estado}</p>
                  <p className="text-xs font-semibold opacity-80 flex items-center gap-1">
                    <MdEvent className="text-sm" />
                    {safeText(entrega.fecha)} · {safeText(entrega.hora) || '—'}
                  </p>
                </div>
                <span className="sm:ml-auto shrink-0 rounded-full bg-white px-3 py-1 text-xs font-extrabold shadow-sm flex items-center gap-1">
                  <MdTag className="text-brand-cyan" />
                  {safeText(entrega.referencia) || 'Sin remisión'}
                </span>
              </div>

              <EntregaInfo solicitud={solicitud} entrega={entrega} />
            </>
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
    </div>
  )
}
