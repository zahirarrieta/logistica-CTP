import {
  MdClose,
  MdTag,
  MdDirectionsCar,
  MdFileOpen,
  MdHourglassEmpty,
  MdAssignmentReturn,
  MdPayments,
  MdReceipt,
  MdTwoWheeler,
  MdDoneAll,
  MdVerified,
} from 'react-icons/md'
import { RiSteering2Line } from 'react-icons/ri'
import { getBadgeColor } from '../estadoColors.js'
import { nombreDeAsignado } from '../solicitudesStore.js'
import NotificationsPanel from '../../../../components/NotificationsPanel.jsx'
import imgAbierto from '../EstadoI/Abierto.png'
import imgPdAuto from '../EstadoI/PdAuto.png'
import imgDevoSol from '../EstadoI/DevoSol.png'
import imgCartera from '../EstadoI/Cartera.png'
import imgRemision from '../EstadoI/Remision.png'
import imgTransitoCarro from '../EstadoI/TransitoCarro.png'
import imgTransitoMoto from '../EstadoI/TransitoMoto.png'

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']

const IMAGENES_POR_ESTADO = {
  Abierto: imgAbierto,
  'Pendiente por Autorización': imgPdAuto,
  'Devolución a Solicitante': imgDevoSol,
  'Retenido por Cartera': imgCartera,
  'En Trámite': imgRemision,
  'En Tránsito': imgTransitoCarro,
  'En Tránsito Parcial': imgTransitoMoto,
}

const ICONOS_POR_ESTADO = {
  Abierto: MdFileOpen,
  'Pendiente por Autorización': MdHourglassEmpty,
  'Devolución a Solicitante': MdAssignmentReturn,
  'Retenido por Cartera': MdPayments,
  'En Trámite': MdReceipt,
  'En Tránsito': MdDirectionsCar,
  'En Tránsito Parcial': MdTwoWheeler,
  'Entregado Parcial': MdDoneAll,
  Entregado: MdVerified,
}

export default function SeguimientoModal({ solicitud, open, onClose, solicitudes }) {
  if (!open || !solicitud) return null

  const enTransito = ESTADOS_TRANSITO.includes(solicitud.estado)
  const conductor = nombreDeAsignado(solicitud.conductor)
  const estado = solicitud.estado || 'Abierto'
  const imagen =
    enTransito && solicitud.vehiculo === 'Moto'
      ? imgTransitoMoto
      : enTransito
        ? imgTransitoCarro
        : IMAGENES_POR_ESTADO[estado]
  const IconoEstado =
    (enTransito && solicitud.vehiculo === 'Moto' ? MdTwoWheeler : ICONOS_POR_ESTADO[estado]) || MdDirectionsCar

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-lg sm:max-w-2xl rounded-2xl shadow-2xl animate-scaleIn flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Seguimiento de la solicitud"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2 shrink-0">
            <span className="grid place-items-center size-9 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <IconoEstado className="text-brand-cyan text-lg" />
            </span>
            SEGUIMIENTO
          </h3>

          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            <div className="flex items-center gap-2 overflow-x-auto min-w-0">
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

        {/* Cuerpo: pista animada compacta */}
        <div className="relative bg-brand-mist h-52 sm:h-64 lg:h-72 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute left-4 right-4 sm:left-8 sm:right-8 top-1/2 h-2.5 sm:h-3 -translate-y-1/2 rounded-full bg-brand-deep/70 overflow-hidden">
              <div
                className="absolute inset-0 animate-roadStripes"
                style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,229,255,0.9) 0 18px, transparent 18px 36px)' }}
              />
            </div>
            <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 -mt-10 border-t-2 border-dashed border-brand-deep/15" />
            <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 mt-10 border-t-2 border-dashed border-brand-deep/15" />
            {imagen ? (
              <img
                src={imagen}
                alt={estado}
                className="absolute top-1/2 -translate-y-1/2 h-24 sm:h-32 lg:h-36 w-auto object-contain animate-truckRide"
              />
            ) : (
              <IconoEstado className="absolute top-1/2 -translate-y-1/2 left-0 text-6xl sm:text-7xl text-brand-cyan/80 animate-truckRide" />
            )}
          </div>

          {/* Estado como badge */}
          <div className="absolute bottom-2.5 sm:bottom-3 inset-x-0 flex flex-col items-center gap-1 px-4">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] sm:text-xs font-bold shadow-md ring-1 ring-white/40 ${getBadgeColor(estado)}`}>
              <IconoEstado className="text-sm" />
              {estado}
            </span>
            {enTransito && (conductor || solicitud.vehiculo || solicitud.placa) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 text-brand-deep px-3 py-1 text-[10px] sm:text-xs font-bold shadow-md ring-1 ring-white/40 max-w-full">
                <RiSteering2Line className="text-xs sm:text-sm shrink-0" />
                <span className="truncate">
                  {conductor} · {solicitud.vehiculo || '—'} · {solicitud.placa || '—'}
                </span>
              </span>
            )}
          </div>

          {/* Notificaciones */}
          <div className="absolute right-3 sm:right-4 top-3 sm:top-4 z-30">
            <NotificationsPanel solicitudes={solicitudes || []} glow solicitudId={solicitud.id} paginado fixed />
          </div>
        </div>
      </div>
    </div>
  )
}