import {
  MdClose,
  MdDescription,
  MdTag,
  MdVerified,
  MdDoneAll,
  MdBusiness,
  MdPlace,
  MdPerson,
  MdWork,
  MdEmail,
  MdNotes,
  MdPhotoCamera,
  MdPictureAsPdf,
  MdLocalShipping,
  MdDirectionsCar,
  MdReceipt,
  MdEvent,
  MdAccessTime,
} from 'react-icons/md'
import { FiStar } from 'react-icons/fi'
import StarRating from '../../../../components/StarRating.jsx'
import { getSoftColor } from '../../../Home/Components/estadoColors.js'
import { safeText } from '../../../Home/Components/solicitudesStore.js'

const ESTADOS_ENTREGA = ['Entregado', 'Entregado Parcial']

const CALIFICACIONES = ['Muy malo', 'Malo', 'Regular', 'Bueno', 'Muy bueno']

const PUNTAJE_COLOR = [
  'bg-red-100 text-red-700',
  'bg-red-100 text-red-700',
  'bg-orange-100 text-orange-700',
  'bg-amber-100 text-amber-800',
  'bg-green-100 text-green-700',
  'bg-green-100 text-green-700',
]

function iniciales(nombre) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

function Seccion({ icon, children }) {
  return (
    <h4 className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-brand-deep">
      <span className="text-brand-cyan">{icon}</span>
      {children}
    </h4>
  )
}

function Dato({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-brand-ink/10 bg-brand-mist/40 px-3 py-2.5 min-w-0">
      <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-ink/50">
        <span className="text-brand-cyan">{icon}</span>
        {label}
      </span>
      <span className="mt-1 block truncate text-sm font-bold text-brand-deep" title={value}>
        {value || '—'}
      </span>
    </div>
  )
}

export default function EntregaDetallesModal({ solicitud, open, onClose }) {
  if (!open || !solicitud) return null

  const historial = Array.isArray(solicitud.historial) ? solicitud.historial : []
  const entrega = [...historial]
    .reverse()
    .find((h) => h.campo === 'estado' && ESTADOS_ENTREGA.includes(h.nuevo))

  const estado = entrega?.nuevo || 'Entregado'
  const IconoEstado = estado === 'Entregado Parcial' ? MdDoneAll : MdVerified
  const encuesta = entrega?.encuesta || null
  const preguntas = Array.isArray(encuesta?.preguntas) ? encuesta.preguntas : []
  const promedio = typeof encuesta?.promedio === 'number' ? encuesta.promedio : null

  const encuestado = safeText(encuesta?.nombreEncuestado)
  const cargo = safeText(encuesta?.cargo)
  const correo = safeText(encuesta?.correo)
  const evidencia = safeText(entrega?.evidencia)
  const esPdf = evidencia.startsWith('data:application/pdf')

  const datos = [
    { icon: <MdLocalShipping className="text-xs" />, label: 'Conductor', value: safeText(entrega?.conductor) || safeText(solicitud.conductor) },
    { icon: <MdDirectionsCar className="text-xs" />, label: 'Vehículo', value: safeText(entrega?.vehiculo) || safeText(solicitud.vehiculo) },
    { icon: <MdTag className="text-xs" />, label: 'Placa', value: safeText(entrega?.placa) || safeText(solicitud.placa) },
    { icon: <MdReceipt className="text-xs" />, label: 'Factura / Remisión', value: safeText(entrega?.referencia) },
    { icon: <MdEvent className="text-xs" />, label: 'Fecha', value: safeText(entrega?.fecha) },
    { icon: <MdAccessTime className="text-xs" />, label: 'Hora', value: safeText(entrega?.hora) },
  ]

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-lg sm:max-w-2xl rounded-2xl shadow-2xl animate-scaleIn max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalles de la entrega ${solicitud.id}`}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdDescription className="text-brand-cyan text-lg" />
            </span>
            DETALLES DE LA ENTREGA
          </h3>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-cyan/15 ring-1 ring-brand-cyan/40 text-brand-cyan px-2.5 sm:px-3 py-1 text-[10px] sm:text-sm font-bold tracking-wide select-none shadow-[0_0_14px_rgba(0,229,255,0.25)]">
              <MdTag className="text-xs sm:text-sm" />
              {solicitud.id}
            </span>
            <button
              aria-label="Cerrar"
              onClick={onClose}
              className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            >
              <MdClose className="text-lg" />
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
          {!entrega ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <MdVerified className="text-5xl text-brand-ink/15 mb-3" />
              <p className="text-base font-extrabold text-brand-deep">Sin datos de entrega</p>
              <p className="text-sm text-brand-ink/60 mt-1 max-w-sm">
                Esta solicitud todavía no registra un cambio de estado a «Entregado» o «Entregado Parcial».
              </p>
            </div>
          ) : (
            <>
              {/* Estado final */}
              <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${getSoftColor(estado)}`}>
                <span className="grid place-items-center size-11 shrink-0 rounded-full bg-white shadow-sm">
                  <IconoEstado className="text-2xl" />
                </span>
                <div className="min-w-0">
                  <span className="block text-[10px] font-extrabold uppercase tracking-wide opacity-70">Estado final</span>
                  <span className="block truncate text-base font-extrabold">{estado}</span>
                </div>
                <span className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-bold">
                  <MdEvent className="text-sm" />
                  {safeText(entrega.fecha) || '—'}
                </span>
              </div>

              {/* Resumen de la solicitud */}
              <div className="rounded-xl bg-brand-ink/5 border border-brand-ink/10 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1 text-brand-ink/70">
                  <MdBusiness className="text-brand-cyan" /> {solicitud.cliente || '—'}
                </span>
                <span className="inline-flex items-center gap-1 text-brand-ink/70">
                  <MdPlace className="text-brand-cyan" /> {solicitud.zona || '—'}
                </span>
                <span className="inline-flex items-center gap-1 text-brand-ink/70">
                  <MdPerson className="text-brand-cyan" /> {safeText(entrega.persona) || '—'}
                </span>
              </div>

              {/* Quién recibió */}
              {encuestado && (
                <div className="space-y-2">
                  <Seccion icon={<MdPerson className="text-sm" />}>Recibió</Seccion>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-brand-cyan/30 bg-brand-mist/30 px-4 py-3">
                    <span className="grid place-items-center size-11 shrink-0 rounded-full bg-brand-cyan text-brand-ink text-sm font-extrabold shadow-cyanGlow">
                      {iniciales(encuestado)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-brand-deep">{encuestado}</p>
                      {cargo && <p className="truncate text-xs font-semibold text-brand-ink/60">{cargo}</p>}
                      {correo && (
                        <a
                          href={`mailto:${correo}`}
                          className="mt-1 inline-flex items-center gap-1 truncate text-xs font-bold text-brand-deep underline decoration-brand-cyan underline-offset-2 hover:text-brand-navy"
                        >
                          <MdEmail className="text-sm shrink-0" />
                          {correo}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Datos logísticos */}
              <div className="space-y-2">
                <Seccion icon={<MdLocalShipping className="text-sm" />}>Datos de la entrega</Seccion>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {datos.map((d) => (
                    <Dato key={d.label} icon={d.icon} label={d.label} value={d.value} />
                  ))}
                </div>
              </div>

              {/* Observaciones */}
              <div className="space-y-2">
                <Seccion icon={<MdNotes className="text-sm" />}>Observaciones</Seccion>
                <p className="rounded-xl bg-brand-mist/60 border-l-2 border-brand-cyan px-3.5 py-2.5 text-sm text-brand-ink/80 whitespace-pre-wrap">
                  {safeText(entrega.nota) || 'Sin observaciones'}
                </p>
              </div>

              {/* Evidencia */}
              {evidencia && (
                <div className="space-y-2">
                  <Seccion icon={<MdPhotoCamera className="text-sm" />}>Evidencia</Seccion>
                  {esPdf ? (
                    <a
                      href={evidencia}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-brand-ink/10 bg-brand-mist/40 px-4 py-3.5 hover:bg-brand-cyan/10 hover:border-brand-cyan transition-colors"
                    >
                      <MdPictureAsPdf className="text-3xl text-red-600 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-extrabold text-brand-deep">Documento PDF de la entrega</span>
                        <span className="block text-xs text-brand-ink/60">Clic para abrir en una nueva pestaña</span>
                      </span>
                    </a>
                  ) : (
                    <a
                      href={evidencia}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir en tamaño completo"
                      className="group relative block rounded-xl overflow-hidden border border-brand-ink/10 bg-brand-ink/5"
                    >
                      <img
                        src={evidencia}
                        alt="Evidencia de la entrega"
                        className="w-full max-h-72 object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                      <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 text-white px-3 py-1 text-[11px] font-bold">
                        <MdVerified className="text-sm text-green-400" /> Foto de la entrega
                      </span>
                    </a>
                  )}
                </div>
              )}

              {/* Encuesta de satisfacción */}
              {preguntas.length > 0 && (
                <div className="space-y-2">
                  <Seccion icon={<FiStar className="text-sm" />}>Encuesta de satisfacción</Seccion>
                  <div className="rounded-2xl border border-brand-cyan/30 bg-brand-mist/30 p-3 sm:p-4 space-y-2">
                    {preguntas.map((p, i) => {
                      const puntaje = p.puntuacion || 0
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 ring-1 ring-brand-ink/10"
                        >
                          <span className="grid place-items-center size-6 shrink-0 rounded-full bg-brand-cyan/20 text-[11px] font-extrabold text-brand-deep">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 text-xs font-semibold text-brand-ink/80">{p.pregunta}</span>
                          <StarRating value={puntaje} disabled compact />
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${PUNTAJE_COLOR[puntaje]}`}
                          >
                            {puntaje ? `${puntaje} · ${CALIFICACIONES[puntaje - 1]}` : 'Sin puntuar'}
                          </span>
                        </div>
                      )
                    })}

                    {promedio !== null && (
                      <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 ring-2 ring-brand-cyan/50 shadow-sm">
                        <span className="text-2xl font-black text-brand-deep tabular-nums">{promedio.toFixed(1)}</span>
                        <StarRating value={Math.round(promedio)} disabled compact />
                        <span className="ml-auto text-right">
                          <span className="block text-[10px] font-extrabold uppercase tracking-wide text-brand-ink/50">
                            Promedio
                          </span>
                          <span className="block text-xs font-extrabold text-brand-deep">
                            {CALIFICACIONES[Math.min(4, Math.max(0, Math.round(promedio) - 1))]}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-brand-ink/10 bg-brand-mist/30 shrink-0 flex items-center justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full bg-brand-cyan px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/70"
          >
            <MdClose className="text-lg" />
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
