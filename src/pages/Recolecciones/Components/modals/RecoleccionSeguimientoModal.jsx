import {
  MdClose, MdTag, MdMap, MdFileOpen, MdReceipt, MdCancel, MdDirectionsCar,
  MdAssignmentReturn, MdReportProblem,
} from 'react-icons/md'
import Modal from '../../../../components/Modal.jsx'
import { getRecoleccionBadge } from '../../../../utils/estadoRecoleccion.js'
import imgAbierto from '../../../../assets/estado/Abierto.png'
import imgRemision from '../../../../assets/estado/Remision.png'
import imgCancelado from '../../../../assets/estado/Cancelado.png'

// Imágenes por estado (las mismas del seguimiento de solicitudes). Los estados
// sin imagen propia caen al ícono que viaja por la pista.
const IMAGENES_POR_ESTADO = {
  Abierto: imgAbierto,
  'En Trámite': imgRemision,
  'Cancelado': imgCancelado,
}

const ICONOS_POR_ESTADO = {
  Abierto: MdFileOpen,
  'En Trámite': MdReceipt,
  'En Tránsito': MdDirectionsCar,
  'Devolución a Solicitante': MdAssignmentReturn,
  Cancelado: MdCancel,
  Fallido: MdReportProblem,
}

// Seguimiento de una recolección: la misma pista animada del seguimiento de las
// solicitudes (la imagen del estado viaja por la vía con líneas en movimiento).
export default function RecoleccionSeguimientoModal({ open, recoleccion, onClose }) {
  if (!open || !recoleccion) return null

  const estado = recoleccion.estado || 'Abierto'
  const imagen = IMAGENES_POR_ESTADO[estado]
  const IconoEstado = ICONOS_POR_ESTADO[estado] || MdDirectionsCar
  const badge = getRecoleccionBadge(estado)

  return (
    <Modal onClose={onClose}>
      <div
        className="relative bg-white text-brand-ink w-full max-w-lg sm:max-w-2xl max-h-[92vh] rounded-2xl shadow-2xl animate-scaleIn flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Seguimiento de la recolección ${recoleccion.codigo}`}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2 shrink-0">
            <span className="grid place-items-center size-9 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdMap className="text-brand-cyan text-lg" />
            </span>
            SEGUIMIENTO
          </h3>

          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            <div className="flex items-center gap-2 overflow-x-auto min-w-0">
              <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand-cyan/15 ring-1 ring-brand-cyan/40 text-brand-cyan px-2.5 sm:px-3 py-1 text-[10px] sm:text-sm font-bold tracking-wide select-none shadow-[0_0_14px_rgba(0,229,255,0.25)]">
                <MdTag className="text-xs sm:text-sm" />
                {(recoleccion.codigo || '').toUpperCase()}
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

        <div className="overflow-y-auto max-h-[calc(92vh-4.5rem)]">
          {/* Pista animada */}
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
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] sm:text-xs font-bold shadow-md ring-1 ring-white/40 ${badge}`}>
                <IconoEstado className="text-sm" />
                {estado}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
