import {
  MdTag,
  MdBusiness,
  MdPlace,
  MdPerson,
  MdEmail,
  MdNotes,
  MdPhotoCamera,
  MdLocalShipping,
  MdDirectionsCar,
  MdReceipt,
  MdEvent,
  MdAccessTime,
  MdVerified,
} from 'react-icons/md'
import { FiStar } from 'react-icons/fi'
import StarRating from './StarRating.jsx'
import EvidenciaVisor from './EvidenciaVisor.jsx'
import { safeText } from '../pages/Home/Components/solicitudesStore.js'

const CALIFICACIONES = ['Malo', 'Regular', 'Bueno']

// Índice = puntuación (0 = sin puntuar, 1 = Malo, 2 = Regular, 3 = Bueno).
const PUNTAJE_COLOR = [
  'bg-gray-100 text-gray-600',
  'bg-red-100 text-red-700',
  'bg-orange-100 text-orange-700',
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

export default function EntregaInfo({ solicitud, entrega, mostrarEncuesta = true }) {
  const encuesta = entrega?.encuesta || null
  const preguntas = Array.isArray(encuesta?.preguntas) ? encuesta.preguntas : []
  const promedio = typeof encuesta?.promedio === 'number' ? encuesta.promedio : null

  const encuestado = safeText(encuesta?.nombreEncuestado)
  const cargo = safeText(encuesta?.cargo)
  const correo = safeText(encuesta?.correo)
  const evidencia = safeText(entrega?.evidencia)

  const datos = [
    { icon: <MdLocalShipping className="text-xs" />, label: 'Conductor', value: safeText(entrega?.conductor) || safeText(solicitud.conductor) },
    { icon: <MdDirectionsCar className="text-xs" />, label: 'Vehículo', value: safeText(entrega?.vehiculo) || safeText(solicitud.vehiculo) },
    { icon: <MdTag className="text-xs" />, label: 'Placa', value: safeText(entrega?.placa) || safeText(solicitud.placa) },
    { icon: <MdReceipt className="text-xs" />, label: 'Factura / Remisión', value: safeText(entrega?.referencia) },
    { icon: <MdEvent className="text-xs" />, label: 'Fecha', value: safeText(entrega?.fecha) },
    { icon: <MdAccessTime className="text-xs" />, label: 'Hora', value: safeText(entrega?.hora) },
  ]

  return (
    <div className="space-y-5">
      {/* Cliente y destino */}
      <div className="rounded-xl bg-brand-ink/5 border border-brand-ink/10 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1 font-bold text-brand-deep">
          <MdBusiness className="text-brand-cyan" /> {solicitud.cliente || '—'}
        </span>
        <span className="inline-flex items-center gap-1 text-brand-ink/70">
          <MdTag className="text-brand-cyan" /> NIT {solicitud.nit || '—'}
        </span>
        <span className="inline-flex items-center gap-1 text-brand-ink/70">
          <MdPlace className="text-brand-cyan" /> {solicitud.zona || '—'}
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

      {/* Datos de la entrega */}
      <div className="space-y-2">
        <Seccion icon={<MdLocalShipping className="text-sm" />}>Datos de la entrega</Seccion>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {datos.map((d) => (
            <Dato key={d.label} icon={d.icon} label={d.label} value={d.value} />
          ))}
          <Dato
            icon={<MdVerified className="text-xs" />}
            label="Registró"
            value={safeText(entrega?.persona)}
          />
        </div>
      </div>

      {/* Observaciones */}
      <div className="space-y-2">
        <Seccion icon={<MdNotes className="text-sm" />}>Observaciones</Seccion>
        <p className="rounded-xl bg-brand-mist/60 border-l-2 border-brand-cyan px-3.5 py-2.5 text-sm text-brand-ink/80 whitespace-pre-wrap">
          {safeText(entrega?.nota) || 'Sin observaciones'}
        </p>
      </div>

      {/* Evidencia */}
      {evidencia && (
        <div className="space-y-2">
          <Seccion icon={<MdPhotoCamera className="text-sm" />}>Evidencia</Seccion>
          <EvidenciaVisor url={evidencia} />
        </div>
      )}

      {/* Encuesta de satisfacción */}
      {mostrarEncuesta && preguntas.length > 0 && (
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
                  <span className="min-w-0 flex-1 text-xs font-semibold text-brand-ink/80 uppercase">{p.pregunta}</span>
                  <StarRating value={puntaje} max={3} disabled compact />
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
                <StarRating value={Math.round(promedio)} max={3} disabled compact />
                <span className="ml-auto text-right">
                  <span className="block text-[10px] font-extrabold uppercase tracking-wide text-brand-ink/50">
                    Promedio
                  </span>
                  <span className="block text-xs font-extrabold text-brand-deep">
                    {CALIFICACIONES[Math.min(2, Math.max(0, Math.round(promedio) - 1))]}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
