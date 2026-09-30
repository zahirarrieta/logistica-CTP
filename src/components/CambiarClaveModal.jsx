import { useEffect, useRef, useState } from 'react'
import { MdClose, MdLockReset } from 'react-icons/md'
import Modal from './Modal.jsx'
import CampoClave from './CampoClave.jsx'
import { useAuth } from '../auth/AuthContext.jsx'

const CLASES_CAMPO =
  'w-full rounded-xl border border-brand-cyan/25 bg-black/25 px-4 py-3 text-brand-mist ' +
  'placeholder:text-brand-mist/40 outline-none transition focus:border-brand-cyan/70 ' +
  'focus:ring-2 focus:ring-brand-cyan/25'

// Las mismas reglas que server/src/contrasenas.js. Se repiten aquí para no
// mandar al servidor una clave que va a ser rechazada, pero el backend sigue
// siendo el que decide: esto es comodidad, no seguridad.
const LARGO_MINIMO = 8
const LARGO_MAXIMO = 200

export default function CambiarClaveModal({ onClose }) {
  const { cambiarClave, usuario } = useAuth()
  const [form, setForm] = useState({ actual: '', nueva: '', repetir: '' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const primerCampoRef = useRef(null)

  useEffect(() => {
    primerCampoRef.current?.focus()
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const alPulsarTecla = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', alPulsarTecla)
    return () => {
      document.body.style.overflow = overflowPrevio
      window.removeEventListener('keydown', alPulsarTecla)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const noCoinciden = form.repetir !== '' && form.repetir !== form.nueva
  const nuevaValida = form.nueva.length >= LARGO_MINIMO && form.nueva.length <= LARGO_MAXIMO

  const escribir = (campo) => (e) => {
    setError('')
    setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (guardando) return

    if (!noCoinciden && !nuevaValida) {
      setError(`La contraseña nueva debe tener entre ${LARGO_MINIMO} y ${LARGO_MAXIMO} caracteres`)
      return
    }
    if (noCoinciden) {
      setError('Las contraseñas nuevas no coinciden')
      return
    }

    setGuardando(true)
    setError('')
    try {
      await cambiarClave({ contrasenaActual: form.actual, contrasenaNueva: form.nueva })
      onClose()
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-cambiar-clave"
        className="relative w-full max-w-md rounded-2xl bg-brand-ink ring-1 ring-brand-cyan/25 shadow-[0_24px_60px_rgba(0,0,0,0.6)] animate-scaleIn max-h-[92vh] flex flex-col overflow-hidden"
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/70 to-transparent" />

        <div className="relative shrink-0 bg-gradient-to-r from-brand-navy to-brand-deep px-5 py-4 flex items-center justify-between gap-3">
          <h3 id="titulo-cambiar-clave" className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdLockReset className="text-brand-cyan text-lg" />
            </span>
            CAMBIAR CONTRASEÑA
          </h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={guardando}
            className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        <form onSubmit={enviar} className="p-5 sm:p-6 overflow-y-auto">
          <p className="mb-4 text-xs leading-relaxed text-brand-mist/70">
            Cambiarás la contraseña de{' '}
            <span className="font-bold text-brand-cyan">{usuario?.correo || 'tu cuenta'}</span>.
            Necesitas escribir la actual para confirmar que eres tú.
          </p>

          <div className="grid gap-3">
            <CampoClave
              name="actual"
              label="la contraseña actual"
              placeholder="Contraseña actual"
              autoComplete="current-password"
              value={form.actual}
              onChange={escribir('actual')}
              className={CLASES_CAMPO}
            />

            <CampoClave
              name="nueva"
              label="la contraseña nueva"
              placeholder={`Contraseña nueva (mínimo ${LARGO_MINIMO})`}
              autoComplete="new-password"
              maxLength={LARGO_MAXIMO}
              value={form.nueva}
              onChange={escribir('nueva')}
              invalid={noCoinciden}
              className={CLASES_CAMPO}
            />

            <CampoClave
              name="repetir"
              label="la contraseña nueva repetida"
              placeholder="Repetir contraseña nueva"
              autoComplete="new-password"
              maxLength={LARGO_MAXIMO}
              value={form.repetir}
              onChange={escribir('repetir')}
              invalid={noCoinciden}
              className={CLASES_CAMPO}
            />
          </div>

          {noCoinciden ? (
            <p role="alert" className="mt-2 text-sm text-red-300">
              Las contraseñas nuevas no coinciden.
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mt-4 text-sm leading-relaxed rounded-xl border border-red-400/40 bg-red-950/40 px-4 py-3 text-red-100"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={guardando || noCoinciden || !nuevaValida}
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl px-8 py-3.5 font-extrabold text-brand-ink bg-gradient-to-br from-brand-cyan to-brand-cyanSoft shadow-cyanGlow transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,229,255,0.6)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-cyan/40 disabled:opacity-60 disabled:cursor-wait disabled:hover:translate-y-0"
          >
            {guardando ? 'GUARDANDO…' : 'CAMBIAR CONTRASEÑA'}
          </button>

          <p className="mt-4 text-xs leading-relaxed text-brand-mist/50">
            Las sesiones que tengas abiertas en otros navegadores seguirán funcionando hasta que
            su token caduque.
          </p>
        </form>
      </div>
    </Modal>
  )
}
