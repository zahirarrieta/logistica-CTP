import { useState, useEffect } from 'react'
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
  MdMap,
  MdCheck,
  MdDeleteOutline,
  MdTimer,
  MdCancel,
} from 'react-icons/md'
import { RiSteering2Line } from 'react-icons/ri'
import { getBadgeColor } from '../../../../utils/estadoColors.js'
import { formatearMs } from '../../../../utils/dashboardUtils.js'
import { nombreDeAsignado, buscarEntrega, buscarDevolucion, parsearMotivoDevolucion, CAMPOS_DEVOLUCION, restanteEliminar } from '../../../../store/solicitudesStore.js'
import { useAuth } from '../../../../auth/AuthContext.jsx'
import CuentaRegresivaDevolucion from '../../../../components/CuentaRegresivaDevolucion.jsx'
import NotificationsPanel from '../../../../components/NotificationsPanel.jsx'
import EntregaInfo from '../../../../components/EntregaInfo.jsx'
import imgAbierto from '../../../../assets/estado/Abierto.png'
import imgPdAuto from '../../../../assets/estado/PdAuto.png'
import imgDevoSol from '../../../../assets/estado/DevoSol.png'
import imgCartera from '../../../../assets/estado/Cartera.png'
import imgRemision from '../../../../assets/estado/Remision.png'
import imgTransitoCarro from '../../../../assets/estado/TransitoCarro.png'
import imgTransitoMoto from '../../../../assets/estado/TransitoMoto.png'
import imgTransitoElite from '../../../../assets/estado/TransitoElite.png'
import imgTransitoCarBog from '../../../../assets/estado/TransitoCarBog.png'
import imgCancelado from '../../../../assets/estado/Cancelado.png'
import Modal from '../../../../components/Modal.jsx'

const ESTADOS_TRANSITO = ['En Tránsito', 'En Tránsito Parcial']

const IMAGENES_POR_ESTADO = {
  Abierto: imgAbierto,
  'Pendiente por Autorización': imgPdAuto,
  'Devolución a Solicitante': imgDevoSol,
  'Retenido por Cartera': imgCartera,
  'En Trámite': imgRemision,
  'En Trámite Parcial': imgRemision,
  'En Tránsito': imgTransitoCarro,
  'En Tránsito Parcial': imgTransitoMoto,
  Cancelado: imgCancelado,
}

const ICONOS_POR_ESTADO = {
  Abierto: MdFileOpen,
  'Pendiente por Autorización': MdHourglassEmpty,
  'Devolución a Solicitante': MdAssignmentReturn,
  'Retenido por Cartera': MdPayments,
  'En Trámite': MdReceipt,
  'En Trámite Parcial': MdReceipt,
  'En Tránsito': MdDirectionsCar,
  'En Tránsito Parcial': MdTwoWheeler,
  'Entregado Parcial': MdDoneAll,
  Entregado: MdVerified,
  Cancelado: MdCancel,
}

export default function SeguimientoModal({ solicitud, open, onClose, solicitudes, onCorregir, onEliminar }) {
  const { account } = useAuth()
  const correoActual = (account?.username || '').trim().toLowerCase()

  // Tick de 1 s solo con el modal abierto: hace que la cuenta de 3 min para
  // eliminar baje en pantalla y que el botón desaparezca al vencer la ventana.
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    if (!open) return undefined
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [open])

  if (!open || !solicitud) return null

  const enTransito = ESTADOS_TRANSITO.includes(solicitud.estado)
  const conductor = nombreDeAsignado(solicitud.conductor)
  const esElite = conductor.toLowerCase() === 'elite'
  const conductorNorm = conductor.toLowerCase().replace(/\s+/g, ' ').trim()
  const esDiegoPena = conductorNorm.includes('diego peña') || conductorNorm.includes('diego pena')
  const esCarroBogota = solicitud.vehiculo === 'KWL-381' || solicitud.placa === 'KWL-381'
  const estado = solicitud.estado || 'Abierto'
  const entrega = buscarEntrega(solicitud)

  // Calcular tiempo restante para eliminar (solo si es del solicitante actual)
  const tiempoEliminar = restanteEliminar(solicitud, correoActual, ahora)
  const esDev = estado === 'Devolución a Solicitante'
  // Cancelado: el pedido se cerró sin entrega, así que no hay «avance» que
  // mostrar. Se saca el motivo de la última entrada del historial.
  const esCancelado = estado === 'Cancelado'
  const motivoCancelacion = esCancelado
    ? [...(Array.isArray(solicitud.historial) ? solicitud.historial : [])]
        .reverse()
        .find((h) => h.campo === 'estado' && h.nuevo === 'Cancelado')?.nota || ''
    : ''
  const devolucion = esDev ? buscarDevolucion(solicitud) : null
  const { campos: camposCorregir, texto: textoMotivo } = parsearMotivoDevolucion(devolucion?.nota)
  const etiquetasCorregir = camposCorregir
    .map((id) => CAMPOS_DEVOLUCION.find((c) => c.id === id)?.etiqueta)
    .filter(Boolean)
  const imagen =
    enTransito && esElite
      ? imgTransitoElite
      : enTransito && esDiegoPena && esCarroBogota
        ? imgTransitoCarBog
        : enTransito && solicitud.vehiculo === 'Moto'
          ? imgTransitoMoto
          : enTransito
            ? imgTransitoCarro
            : IMAGENES_POR_ESTADO[estado]
  const IconoEstado =
    (enTransito && !esElite && solicitud.vehiculo === 'Moto' ? MdTwoWheeler : ICONOS_POR_ESTADO[estado]) || MdDirectionsCar

  return (
    <>
    <Modal onClose={onClose}>
      <div
        className="relative bg-white text-brand-ink w-full max-w-lg sm:max-w-2xl max-h-[92vh] rounded-2xl shadow-2xl animate-scaleIn flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Seguimiento de la solicitud"
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
                {solicitud.id}
              </span>
            </div>
            {tiempoEliminar !== null && tiempoEliminar > 0 && onEliminar && (
              <button
                type="button"
                onClick={() => onEliminar(solicitud)}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 text-red-600 hover:bg-red-500/20 px-2.5 py-1.5 text-xs font-bold transition-colors"
                title="Eliminar solicitud"
                aria-label="Eliminar solicitud"
              >
                <MdDeleteOutline className="text-lg" />
                <MdTimer className="text-lg" />
                <span className="ml-1">{formatearMs(tiempoEliminar)}</span>
              </button>
            )}
            <button
              aria-label="Cerrar"
              onClick={onClose}
              className="grid place-items-center size-9 shrink-0 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            >
              <MdClose className="text-lg" />
            </button>
          </div>
        </div>

        {esCancelado ? (
          /* Cancelado: no hay avance de entrega que animar */
          <div className="overflow-y-auto max-h-[calc(92vh-4.5rem)] p-4 sm:p-6">
            <div className="rounded-2xl border border-gray-300 bg-gray-100 px-5 py-6 flex flex-col items-center text-center gap-3">
              <img
                src={imgCancelado}
                alt="Pedido cancelado"
                className="h-32 sm:h-40 w-auto object-contain"
              />
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${getBadgeColor(estado)}`}>
                <MdCancel className="text-sm" />
                {estado}
              </span>
              <p className="text-sm font-bold text-brand-ink/70">
                Este pedido fue cancelado y no se entregará.
              </p>
              {motivoCancelacion ? (
                <p className="max-w-md rounded-lg bg-white/80 border-l-2 border-gray-400 px-3 py-2 text-sm text-brand-ink/70 whitespace-pre-wrap">
                  Motivo: {motivoCancelacion}
                </p>
              ) : (
                <p className="text-sm text-brand-ink/50">Revisa el historial de cambios para ver el detalle.</p>
              )}
            </div>
          </div>
        ) : entrega ? (
          /* Detalles de la entrega: sin pista animada ni encuesta */
          <div className="relative">
            <div className="absolute right-3 sm:right-4 top-3 sm:top-4 z-30">
              <NotificationsPanel solicitudes={solicitudes || []} glow solicitudId={solicitud.id} paginado fixed />
            </div>
            <div className="overflow-y-auto p-4 sm:p-6 pt-14 sm:pt-14 max-h-[calc(92vh-4.5rem)]">
              <EntregaInfo solicitud={solicitud} entrega={entrega} mostrarEncuesta />
            </div>
          </div>
        ) : (
          /* Cuerpo: pista animada compacta */
          <div className="overflow-y-auto max-h-[calc(92vh-4.5rem)]">
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

            {esDev && (
              <div className="m-4 sm:m-6 rounded-xl border border-fuchsia-300 bg-fuchsia-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-fuchsia-700">
                    <MdAssignmentReturn className="text-base" />
                    Solicitud devuelta para corrección
                  </p>
                  <CuentaRegresivaDevolucion solicitud={solicitud} compacto />
                </div>
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
                  <p className="mt-1.5 text-sm font-medium text-fuchsia-800/80">El administrador devolvió esta solicitud. Revisa los datos y vuelve a enviarla.</p>
                )}
                {onCorregir && (
                  <button
                    type="button"
                    onClick={() => onCorregir(solicitud)}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-fuchsia-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-fuchsia-700 hover:-translate-y-0.5 transition-all"
                  >
                    <MdAssignmentReturn className="text-lg" />
                    Corregir y reenviar
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
    </>
  )
}