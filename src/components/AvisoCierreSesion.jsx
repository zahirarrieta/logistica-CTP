import { useEffect } from 'react'
import { MdTimer } from 'react-icons/md'
import Modal from './Modal.jsx'

// Cuenta atrás del cierre por inactividad. Va con el número grande porque es lo
// único que el usuario tiene que mirar: dice cuánto le queda para que se le cierre
// la sesión.
//
// El fondo NO se cierra con un clic y no hay aspa en la cabecera: la única forma
// de cancelar el cierre es el botón. Si el clic en cualquier parte lo cerrara, un
// movimiento de mouse sin querer (o el clic que iba a otro botón) lo haría
// desaparecer, y entonces no avisaría de nada.
//
// El número va en font-display (Bebas Neue), la misma de los títulos grandes de
// Login y Home. El resto del texto va en Montserrat, la fuente por defecto de la app.
//
// Lo que NO se guarda al cerrar sesión: las solicitudes siguen en localStorage
// (cerrar sesión solo borra el token), y el store vuelve a subirlas al entrar.
export default function AvisoCierreSesion({ abierto, restante, onContinuar }) {
  useEffect(() => {
    if (!abierto) return undefined
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflowPrevio
    }
  }, [abierto])

  if (!abierto) return null

  const minutos = Math.floor(restante / 60)
  const segundos = restante % 60
  const reloj = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`
  const urgente = restante <= 15

  return (
    <Modal onClose={undefined}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titulo-cierre-sesion"
        aria-describedby="texto-cierre-sesion"
        className="relative bg-white text-brand-ink w-full max-w-md rounded-2xl shadow-2xl animate-scaleIn overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3">
          <h3
            id="titulo-cierre-sesion"
            className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2"
          >
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdTimer className={urgente ? 'text-amber-300 text-lg' : 'text-brand-cyan text-lg'} />
            </span>
            SESIÓN POR CERRARSE
          </h3>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 text-center">
          <p id="texto-cierre-sesion" className="text-sm leading-relaxed text-brand-ink/70">
            No registraste actividad en esta pantalla durante un rato. Para que nadie
            más use esta sesión abierta, se cerrará sola en:
          </p>

          <div className="my-5" role="timer" aria-live="off">
            <span
              className={
                urgente
                  ? 'block font-display text-[clamp(4rem,14vw,6.5rem)] leading-[0.9] text-red-600 animate-pulse'
                  : 'block font-display text-[clamp(4rem,14vw,6.5rem)] leading-[0.9] text-brand-deep'
              }
            >
              {reloj}
            </span>
            <span className="mt-1 block text-xs font-bold uppercase tracking-widest text-brand-ink/45">
              minutos y segundos
            </span>
          </div>

          <button
            type="button"
            onClick={onContinuar}
            className="inline-flex w-full items-center justify-center rounded-2xl px-8 py-3.5 font-extrabold text-brand-ink bg-gradient-to-br from-brand-cyan to-brand-cyanSoft shadow-cyanGlow transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,229,255,0.6)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-cyan/40"
          >
            SEGUIR TRABAJANDO
          </button>

          <p className="mt-4 text-xs leading-relaxed text-brand-ink/50">
            Si no pulsas el botón, la sesión se cerrará sola. Al volver a iniciar sesión
            tus solicitudes seguirán ahí: no se borra nada.
          </p>
        </div>
      </div>
    </Modal>
  )
}