import { MdClose, MdTag, MdDirectionsCar } from 'react-icons/md'
import { RiSteering2Line } from 'react-icons/ri'
import { getBadgeColor, getDotColor } from '../estadoColors.js'
import { nombreDeAsignado } from '../solicitudesStore.js'
import NotificationsPanel from '../../../../components/NotificationsPanel.jsx'

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']

export default function SeguimientoModal({ solicitud, open, onClose, solicitudes }) {
  if (!open || !solicitud) return null

  const enTransito = ESTADOS_TRANSITO.includes(solicitud.estado)
  const conductor = nombreDeAsignado(solicitud.conductor)
  const estado = solicitud.estado || 'Abierto'

  const conductorCls =
    {
      'En Tránsito': 'bg-purple-100 text-purple-700 ring-purple-300/60',
      'En Tránsito Parcial': 'bg-yellow-100 text-yellow-800 ring-yellow-300/60',
    }[estado] || 'bg-brand-cyan/10 text-brand-deep ring-brand-cyan/30'

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-5xl rounded-2xl shadow-2xl animate-scaleIn h-[90vh] sm:h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Seguimiento de la solicitud"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2 shrink-0">
            <span className="grid place-items-center size-9 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdDirectionsCar className="text-brand-cyan text-lg" />
            </span>
            SEGUIMIENTO
          </h3>

          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            <div className="flex items-center gap-2 overflow-x-auto min-w-0">
              <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-bold ${getBadgeColor(estado)}`}>
                <span className={`size-2 rounded-full ${getDotColor(estado)}`} />
                {estado}
              </span>
              {enTransito && conductor && (
                <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-bold ring-1 ${conductorCls}`}>
                  <RiSteering2Line className="text-xs sm:text-sm" />
                  Conductor: {conductor}
                </span>
              )}
              <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand-cyan/15 ring-1 ring-brand-cyan/40 text-brand-cyan px-2.5 sm:px-3 py-1 text-[10px] sm:text-sm font-bold tracking-wide select-none shadow-[0_0_14px_rgba(0,229,255,0.25)]">
                <MdTag className="text-xs sm:text-sm" />
                {solicitud.id}
              </span>
            </div>
            <button
              aria-label="Cerrar"
              onClick={onClose}
              className="grid place-items-center size-9 shrink-0 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            >
              <MdClose className="text-lg" />
            </button>
          </div>
        </div>

        {/* Cuerpo: la animación llena todo el modal */}
        <div className="relative flex-1 overflow-hidden bg-brand-diagonal">
          {enTransito && (
            <>
              <div className="absolute inset-0">
                {/* Carretera */}
                <div className="absolute left-3 right-3 sm:left-8 sm:right-8 top-1/2 h-3 sm:h-4 -translate-y-1/2 rounded-full bg-brand-deep/70 overflow-hidden">
                  <div
                    className="absolute inset-0 animate-roadStripes"
                    style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,229,255,0.9) 0 22px, transparent 22px 44px)' }}
                  />
                </div>
                <div className="absolute left-1 right-1 top-1/2 -translate-y-1/2 -mt-10 border-t-2 border-dashed border-white/10" />
                <div className="absolute left-1 right-1 top-1/2 -translate-y-1/2 mt-10 border-t-2 border-dashed border-white/10" />
                {/* Carro */}
                <img
                  src="/Principal/PRY-590.png"
                  alt="Carro en movimiento"
                  className="absolute top-1/2 -translate-y-1/2 h-32 sm:h-52 lg:h-60 w-auto object-contain animate-truckRide drop-shadow-[0_12px_24px_rgba(0,229,255,0.55)]"
                />
              </div>

              {/* Pie de pista */}
              <div className="absolute bottom-3 sm:bottom-5 inset-x-0 flex items-center justify-center gap-2 text-brand-cyan text-sm sm:text-lg font-bold uppercase tracking-widest">
                <MdDirectionsCar className="text-xl sm:text-2xl" />
                {solicitud.estado}
              </div>
            </>
          )}

          {!enTransito && (
            <div className="flex flex-col items-center justify-center gap-4 py-14 text-center h-full">
              <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${getBadgeColor(estado)}`}>
                <span className={`size-2.5 rounded-full ${getDotColor(estado)}`} />
                {estado}
              </span>
              <p className="text-brand-ink/50 text-sm">Tu solicitud aún no está en tránsito.</p>
            </div>
          )}

          {/* Notificaciones al lado de la animación */}
          {enTransito && (
            <div className="absolute right-4 sm:right-6 top-4 sm:top-6 z-30">
              <NotificationsPanel solicitudes={solicitudes || []} glow solicitudId={solicitud.id} paginado />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}