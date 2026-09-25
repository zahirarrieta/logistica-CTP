import { MdClose, MdStar, MdChevronRight } from 'react-icons/md'
import StarRating from '../../../../components/StarRating.jsx'
import { getBadgeColor } from '../../../Home/Components/estadoColors.js'
import { nivelEstrella } from '../dashboardUtils.js'

// Modal que lista pedidos o entregas (por conductor, cliente, asignado,
// respuesta con X estrellas, etc.). Cada fila abre el detalle completo del pedido.
export default function PedidosListaModal({ titulo, items = [], open, onClose, onVerPedido }) {
  if (!open || !titulo) return null

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
        aria-label={titulo}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2 min-w-0">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow shrink-0">
              <MdStar className="text-brand-cyan text-lg" />
            </span>
            <span className="min-w-0">
              <span className="block truncate">{titulo}</span>
              <span className="block text-[11px] font-bold text-white/70 -mt-0.5">
                {items.length} {items.length === 1 ? 'resultado' : 'resultados'}
              </span>
            </span>
          </h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="grid place-items-center size-8 shrink-0 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto p-3 sm:p-4">
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-brand-ink/50">Sin resultados</p>
          ) : (
            <div className="space-y-1.5">
              {items.map((p, i) => (
                <button
                  key={`${p.id}-${p.fechaHora}-${i}`}
                  type="button"
                  onClick={() => onVerPedido(p.id)}
                  className="flex w-full items-center gap-3 rounded-xl bg-brand-mist/50 ring-1 ring-brand-ink/5 px-3 py-2.5 text-left text-sm hover:bg-brand-cyan/10 transition-colors"
                  title={`Ver detalle de ${p.id}`}
                >
                  <span className="shrink-0 font-extrabold text-brand-deep">{p.id}</span>
                  <span className="min-w-0 flex-1 truncate text-brand-ink/80">
                    {p.cliente} <span className="text-brand-ink/40">· {p.zona}</span>
                  </span>
                  {typeof p.promedio === 'number' ? (
                    <span className="hidden sm:inline-flex shrink-0 items-center gap-1.5 text-[10px] font-bold text-brand-ink/50">
                      <StarRating value={nivelEstrella(p.promedio)} max={3} disabled compact />
                      <span className="font-extrabold text-brand-ink">{p.promedio.toFixed(1)}</span>
                      <span className="text-brand-ink/40">{p.votos} votos</span>
                    </span>
                  ) : (
                    <span className={`hidden sm:inline-flex shrink-0 text-[10px] font-extrabold rounded-full px-2 py-0.5 ${getBadgeColor(p.estado)}`}>
                      {p.estado}
                    </span>
                  )}
                  <span className="hidden md:inline-block shrink-0 text-[11px] font-bold text-brand-ink/40 tabular-nums">{p.fechaHora}</span>
                  <MdChevronRight className="shrink-0 text-brand-deep/40" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}