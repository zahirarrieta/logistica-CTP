import { MdClose, MdHourglassEmpty, MdChevronRight } from 'react-icons/md'
import { formatHoras, HEX_ESTADO } from '../dashboardUtils.js'

// Modal que lista los pedidos que pasaron por una etapa (estado) con su tiempo
// de permanencia. Cada fila abre el detalle completo del pedido.
export default function EtapaPedidosModal({ etapa, open, onClose, onVerPedido }) {
  if (!open || !etapa) return null

  const pedidos = etapa.pedidos || []
  const color = HEX_ESTADO[etapa.estado] || '#94A3B8'

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
        aria-label={`Pedidos en la etapa ${etapa.estado}`}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2 min-w-0">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow shrink-0">
              <MdHourglassEmpty className="text-brand-cyan text-lg" />
            </span>
            <span className="min-w-0">
              <span className="block truncate" style={{ color }}>{etapa.estado}</span>
              <span className="block text-[11px] font-bold text-white/70 -mt-0.5">
                {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'} · promedio {formatHoras(etapa.promedio)}
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

        {/* Lista de pedidos */}
        <div className="overflow-y-auto p-3 sm:p-4">
          {pedidos.length === 0 ? (
            <p className="py-10 text-center text-sm text-brand-ink/50">Sin pedidos registrados en esta etapa</p>
          ) : (
            <div className="space-y-1.5">
              {pedidos.map((p, i) => (
                <button
                  key={`${p.id}-${p.entro}-${i}`}
                  type="button"
                  onClick={() => onVerPedido(p.id)}
                  className="flex w-full items-center gap-3 rounded-xl bg-brand-mist/50 ring-1 ring-brand-ink/5 px-3 py-2.5 text-left text-sm hover:bg-brand-cyan/10 transition-colors"
                  title={`Ver detalle de ${p.id}`}
                >
                  <span className="shrink-0 font-extrabold text-brand-deep">{p.id}</span>
                  <span className="min-w-0 flex-1 truncate text-brand-ink/80">
                    {p.cliente} <span className="text-brand-ink/40">· {p.zona}</span>
                  </span>
                  <span className="hidden sm:inline-flex shrink-0 items-center gap-1.5 text-[10px] font-bold text-brand-ink/50">
                    <span className="inline-block size-2 rounded-full" style={{ backgroundColor: color }} />
                    {p.salioHacia || '—'}
                  </span>
                  <span className="shrink-0 text-[11px] font-bold text-brand-ink/40 tabular-nums">{p.entro}</span>
                  <span className="shrink-0 font-extrabold text-brand-ink tabular-nums">{formatHoras(p.horas)}</span>
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