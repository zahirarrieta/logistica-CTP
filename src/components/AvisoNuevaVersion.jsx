import { MdSystemUpdate, MdRefresh } from 'react-icons/md'
import Modal from './Modal.jsx'
import useNuevaVersion from '../hooks/useNuevaVersion.js'

// Recarga la app para cargar la versión nueva. El service worker sirve el HTML y
// los assets con la red por delante, así un reload simple ya trae lo último; no
// hace falta desregistrar nada.
function aplicarActualizacion() {
  window.location.reload()
}

// Fecha legible a partir de 'YYYY-MM-DD' (o lo que venga en version.json). Si no
// se puede interpretar, se muestra tal cual.
function fechaLegible(fecha) {
  if (!fecha) return ''
  const d = new Date(`${fecha}T12:00:00`)
  if (Number.isNaN(d.getTime())) return String(fecha)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Aviso de nueva versión. Aparece solo cuando el servidor publica un
// version.json con una versión distinta a la que el usuario tiene cargada (ver
// useNuevaVersion). Muestra la fecha y los cambios, y un botón para actualizar al
// momento. El fondo NO cierra el modal: es un aviso importante, se confirma o se
// pospone con los botones.
export default function AvisoNuevaVersion() {
  const { disponible, info, posponer } = useNuevaVersion()

  if (!disponible || !info) return null

  const cambios = Array.isArray(info.cambios) ? info.cambios : []

  return (
    <Modal onClose={undefined} overlayClassName="fixed inset-0 z-[1300] bg-black/75 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto">
      <div
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titulo-nueva-version"
        aria-describedby="texto-nueva-version"
        className="relative bg-white text-brand-ink w-full max-w-md rounded-2xl shadow-2xl animate-scaleIn overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center gap-3">
          <h3
            id="titulo-nueva-version"
            className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2"
          >
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdSystemUpdate className="text-brand-cyan text-lg" />
            </span>
            NUEVA VERSIÓN DISPONIBLE
          </h3>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6">
          <p id="texto-nueva-version" className="text-sm leading-relaxed text-brand-ink/70">
            Publicamos una actualización de la app. Recarga para usar la versión nueva.
          </p>

          {info.fecha && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-cyan/15 ring-1 ring-brand-cyan/40 px-3 py-1.5 text-xs font-bold text-brand-deep">
              <span className="uppercase tracking-widest text-brand-ink/50">Versión</span>
              {fechaLegible(info.fecha)}
            </p>
          )}

          {cambios.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-extrabold uppercase tracking-widest text-brand-ink/50 mb-2">
                Qué incluye
              </p>
              <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {cambios.map((cambio, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-brand-ink/80">
                    <span className="mt-1.5 size-1.5 rounded-full bg-brand-cyan shrink-0" />
                    <span>{cambio}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={aplicarActualizacion}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-8 py-3.5 font-extrabold text-brand-ink bg-gradient-to-br from-brand-cyan to-brand-cyanSoft shadow-cyanGlow transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,229,255,0.6)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-cyan/40"
          >
            <MdRefresh className="text-lg" />
            ACTUALIZAR AHORA
          </button>

          <button
            type="button"
            onClick={posponer}
            className="mt-2 w-full rounded-2xl px-8 py-2.5 text-sm font-bold text-brand-ink/60 hover:text-brand-ink transition"
          >
            Más tarde
          </button>
        </div>
      </div>
    </Modal>
  )
}
