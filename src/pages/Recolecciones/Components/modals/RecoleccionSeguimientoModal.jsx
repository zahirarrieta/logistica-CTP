import {
  MdClose, MdTag, MdMap, MdFileOpen, MdReceipt, MdCancel, MdDirectionsCar,
  MdAssignmentReturn, MdReportProblem, MdCheck, MdTwoWheeler,
} from 'react-icons/md'
import Modal from '../../../../components/Modal.jsx'
import { getRecoleccionBadge } from '../../../../utils/estadoRecoleccion.js'
import imgAbierto from '../../../../assets/estado/Abierto.png'
import imgRemision from '../../../../assets/estado/Remision.png'
import imgDevoSol from '../../../../assets/estado/DevoSol.png'
import imgCancelado from '../../../../assets/estado/Cancelado.png'
import imgTransitoCarro from '../../../../assets/estado/TransitoCarro.png'
import imgTransitoMoto from '../../../../assets/estado/TransitoMoto.png'
import imgTransitoElite from '../../../../assets/estado/TransitoElite.png'
import imgTransitoCarBog from '../../../../assets/estado/TransitoCarBog.png'

// Imágenes por estado (las mismas del seguimiento de solicitudes). Los estados
// sin imagen propia caen al ícono que viaja por la pista.
const IMAGENES_POR_ESTADO = {
  Abierto: imgAbierto,
  'En Trámite': imgRemision,
  'Devolución a Solicitante': imgDevoSol,
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
export default function RecoleccionSeguimientoModal({ open, recoleccion, onClose, onCorregir }) {
  if (!open || !recoleccion) return null

  const estado = recoleccion.estado || 'Abierto'
  // En «En Tránsito» la imagen depende del vehículo asignado (igual que en el
  // seguimiento de solicitudes): Elite, Diego Peña con la placa KWL-381, moto o
  // carro genérico. El resto de estados usan su imagen fija.
  const enTransito = estado === 'En Tránsito'
  const conductor = String(recoleccion.conductor || '').trim()
  const esElite = conductor.toLowerCase() === 'elite'
  const conductorNorm = conductor.toLowerCase().replace(/\s+/g, ' ').trim()
  const esDiegoPena = conductorNorm.includes('diego peña') || conductorNorm.includes('diego pena')
  const esCarroBogota = recoleccion.vehiculo === 'KWL-381' || recoleccion.placa === 'KWL-381'
  const imagen =
    enTransito && esElite
      ? imgTransitoElite
      : enTransito && esDiegoPena && esCarroBogota
        ? imgTransitoCarBog
        : enTransito && recoleccion.vehiculo === 'Moto'
          ? imgTransitoMoto
          : enTransito
            ? imgTransitoCarro
            : IMAGENES_POR_ESTADO[estado]
  const IconoEstado =
    (enTransito && !esElite && recoleccion.vehiculo === 'Moto' ? MdTwoWheeler : ICONOS_POR_ESTADO[estado]) || MdDirectionsCar
  const badge = getRecoleccionBadge(estado)

  // Devolución: se muestra el MISMO panel que en el seguimiento de solicitudes
  // (incluido el icono de «Devolución a Solicitante») y, cuando quien mira es el
  // dueño, el botón para corregir y reenviar. El motivo viaja codificado en la
  // nota del historial con el formato «[CORREGIR: A, B] texto».
  const devolucion =
    estado === 'Devolución a Solicitante'
      ? [...(Array.isArray(recoleccion.historial) ? recoleccion.historial : [])]
          .reverse()
          .find((h) => h?.campo === 'estado' && h.nuevo === 'Devolución a Solicitante') || null
      : null
  const crudoMotivo = String(devolucion?.nota || '')
  const coincide = /^\[CORREGIR:\s*([^\]]*)\]\s*/.exec(crudoMotivo)
  const etiquetasCorregir = coincide
    ? coincide[1].split(',').map((s) => s.trim()).filter(Boolean)
    : []
  const textoMotivo = coincide ? crudoMotivo.slice(coincide[0].length).trim() : crudoMotivo.trim()

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

          {devolucion && (
            <div className="m-4 sm:m-6 rounded-xl border border-fuchsia-300 bg-fuchsia-50 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-fuchsia-700">
                <MdAssignmentReturn className="text-base" />
                Recolección devuelta para corrección
              </p>
              {etiquetasCorregir.length > 0 && (
                <div className="mt-1.5">
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-fuchsia-700/80">
                    Debes corregir:
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {etiquetasCorregir.map((et) => (
                      <span
                        key={et}
                        className="inline-flex items-center gap-1 rounded-full bg-fuchsia-600/15 ring-1 ring-fuchsia-400/50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-fuchsia-800"
                      >
                        <MdCheck className="text-sm" />
                        {et}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {textoMotivo ? (
                <p className="mt-1.5 text-sm font-semibold text-fuchsia-900">Motivo: {textoMotivo}</p>
              ) : (
                <p className="mt-1.5 text-sm font-medium text-fuchsia-800/80">
                  El administrador devolvió esta recolección. Revisa los datos y vuelve a enviarla.
                </p>
              )}
              {onCorregir && (
                <button
                  type="button"
                  onClick={() => onCorregir(recoleccion)}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-fuchsia-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-fuchsia-700 hover:-translate-y-0.5 transition-all"
                >
                  <MdAssignmentReturn className="text-lg" />
                  Corregir y reenviar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
