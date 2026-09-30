import { useEffect, useRef, useState } from 'react'
import { MdClose, MdPersonAdd } from 'react-icons/md'
import Modal from '../../components/Modal.jsx'
import CampoClave from '../../components/CampoClave.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'

// Mismos estilos de campo que el login: el modal vive encima de esa pantalla y
// otra paleta aquí dentro parecería otra aplicación.
const CLASES_CAMPO =
  'w-full rounded-xl border border-brand-cyan/25 bg-black/25 px-4 py-3 text-brand-mist ' +
  'placeholder:text-brand-mist/40 outline-none transition focus:border-brand-cyan/70 ' +
  'focus:ring-2 focus:ring-brand-cyan/25'

export default function RegistroModal({ onClose }) {
  const { registro, errorLogin, loginEnCurso, limpiarAviso } = useAuth()
  const [form, setForm] = useState({ nombre: '', correo: '', contrasena: '' })
  const [confirmacion, setConfirmacion] = useState('')
  const primerCampoRef = useRef(null)

  useEffect(() => {
    // Quien pulsa "Regístrate aquí" va a escribir, no a mirar: el foco arranca
    // ya en el nombre y no hay que cazarlo con el ratón.
    primerCampoRef.current?.focus()
    // El fallo del login previo no es de este formulario, así que no se arrastra
    // dentro del modal.
    limpiarAviso?.()

    // Sin esto, en móvil la página de detrás se desplaza al arrastrar y el modal
    // parece desatado de la pantalla.
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const alPulsarTecla = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', alPulsarTecla)
    return () => {
      document.body.style.overflow = overflowPrevio
      window.removeEventListener('keydown', alPulsarTecla)
    }
    // Solo al abrir. En cada pulsación no se debe volver a robar el foco ni a
    // reponer el scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // La contraseña se pide dos veces. No es TANTA seguridad como un token de
  // confirmación por correo, pero evita el error real de este tipo de pantalla:
  // teclear mal y no enterarse hasta el día siguiente.
  const faltaConfirmar = confirmacion !== form.contrasena

  const escribir = (campo) => (e) => {
    if (errorLogin) limpiarAviso?.()
    setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  const enviar = (e) => {
    e.preventDefault()
    if (loginEnCurso || faltaConfirmar) return
    registro({ nombre: form.nombre, correo: form.correo, contrasena: form.contrasena })
  }

  return (
    <Modal onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-registro"
        className="relative w-full max-w-md rounded-2xl bg-brand-ink ring-1 ring-brand-cyan/25 shadow-[0_24px_60px_rgba(0,0,0,0.6)] animate-scaleIn max-h-[92vh] flex flex-col overflow-hidden"
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/70 to-transparent" />

        {/* Cabecera */}
        <div className="relative shrink-0 bg-gradient-to-r from-brand-navy to-brand-deep px-5 py-4 flex items-center justify-between gap-3">
          <h3 id="titulo-registro" className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdPersonAdd className="text-brand-cyan text-lg" />
            </span>
            CREAR CUENTA
          </h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        {/* Formulario. `onSubmit` y no `onClick` para poder mandar con Enter. */}
        <form onSubmit={enviar} className="p-5 sm:p-6 overflow-y-auto">
          <div className="grid gap-3">
            <input
              ref={primerCampoRef}
              type="text"
              name="nombre"
              autoComplete="name"
              required
              maxLength={190}
              value={form.nombre}
              onChange={escribir('nombre')}
              placeholder="Nombre completo"
              aria-label="Nombre completo"
              className={CLASES_CAMPO}
            />

            <input
              type="email"
              name="correo"
              autoComplete="email"
              required
              maxLength={190}
              value={form.correo}
              onChange={escribir('correo')}
              placeholder="Correo electrónico"
              aria-label="Correo electrónico"
              className={CLASES_CAMPO}
            />

            {/* `new-password` en los dos: si el gestor autocompleta la misma clave
                en ambos campos de una cuenta nueva, el usuario nunca la elige. */}
            <CampoClave
              name="contrasena"
              label="la contraseña"
              placeholder="Contraseña (mínimo 8)"
              autoComplete="new-password"
              minLength={8}
              value={form.contrasena}
              onChange={escribir('contrasena')}
              className={CLASES_CAMPO}
            />

            <CampoClave
              name="confirmacion"
              label="la contraseña repetida"
              placeholder="Repetir contraseña"
              autoComplete="new-password"
              invalid={faltaConfirmar && !!confirmacion}
              value={confirmacion}
              onChange={(e) => {
                if (errorLogin) limpiarAviso?.()
                setConfirmacion(e.target.value)
              }}
              className={`${CLASES_CAMPO} ${faltaConfirmar && confirmacion ? 'border-red-400/70' : ''}`}
            />
          </div>

          {faltaConfirmar && confirmacion ? (
            <p role="alert" className="mt-2 text-sm text-red-300">
              Las contraseñas no coinciden.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loginEnCurso || faltaConfirmar}
            className="group relative mt-5 inline-flex w-full items-center justify-center rounded-2xl px-8 py-3.5 font-extrabold text-brand-ink bg-gradient-to-br from-brand-cyan to-brand-cyanSoft shadow-cyanGlow transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,229,255,0.6)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-cyan/40 disabled:opacity-60 disabled:cursor-wait disabled:hover:translate-y-0"
          >
            <span className="relative z-10 inline-flex items-center justify-center gap-3 tracking-wide">
              <MdPersonAdd className="text-xl" />
              {loginEnCurso ? 'CREANDO CUENTA…' : 'REGISTRARME'}
            </span>
          </button>

          <p className="mt-4 text-sm text-center text-brand-mist/80">
            ¿Ya tienes cuenta?{' '}
            <button
              type="button"
              onClick={onClose}
              className="font-bold text-brand-cyan underline underline-offset-4 hover:text-brand-cyanSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40 rounded"
            >
              Inicia sesión
            </button>
          </p>

          {/* El error va dentro del modal: si saliera detrás del velo, con la
              pantalla de login aún abierta, parecería un fallo de acceso. */}
          {errorLogin ? (
            <p
              role="alert"
              className="mt-4 text-sm leading-relaxed rounded-xl border border-red-400/40 bg-red-950/40 px-4 py-3 text-red-100"
            >
              {errorLogin}
            </p>
          ) : null}

          <p className="mt-4 text-xs leading-relaxed text-brand-mist/60">
            Al registrarte entras con permisos de solicitante: solo verás tus propias solicitudes. Si
            necesitas entrar al panel de administrador o al módulo de conductor, pídele a un
            administrador que suba tu rol.
          </p>
        </form>
      </div>
    </Modal>
  )
}
