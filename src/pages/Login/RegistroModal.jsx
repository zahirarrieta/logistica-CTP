import { useEffect, useRef, useState } from 'react'
import { MdClose, MdPersonAdd } from 'react-icons/md'
import Modal from '../../components/Modal.jsx'
import CampoClave from '../../components/CampoClave.jsx'
import CampoEmailDominio from '../../components/CampoEmailDominio.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'

// Mismos estilos que CambiarClaveModal / AdjuntosModal: fondo blanco, texto oscuro
const CLASES_CAMPO =
  'w-full rounded-xl border border-brand-ink/15 bg-white px-4 py-3 text-brand-ink ' +
  'placeholder:text-brand-ink/40 outline-none transition focus:border-brand-cyan/70 ' +
  'focus:ring-2 focus:ring-brand-cyan/25'

const DOMINIO = '@ctpmedica.com'

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

  const sanearCorreo = (valor) => {
    const i = valor.indexOf('@')
    return i >= 0 ? valor.slice(0, i) : valor
  }

  const escribir = (campo) => (e) => {
    if (errorLogin) limpiarAviso?.()
    const valor = campo === 'correo' ? sanearCorreo(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  // Captura autofill del navegador (onChange no siempre dispara al autollenar)
  const alSalirCorreo = (e) => {
    const limpio = sanearCorreo(e.target.value)
    if (limpio !== form.correo) setForm((f) => ({ ...f, correo: limpio }))
  }

  const enviar = (e) => {
    e.preventDefault()
    if (loginEnCurso || faltaConfirmar) return
    const correoCompleto = form.correo.includes('@') ? form.correo : form.correo + DOMINIO
    registro({ nombre: form.nombre, correo: correoCompleto, contrasena: form.contrasena })
  }

  return (
    <Modal onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-registro"
        className="relative bg-white text-brand-ink w-full max-w-md rounded-2xl shadow-2xl animate-scaleIn max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <form onSubmit={enviar} className="flex flex-col">
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

            <CampoEmailDominio
              name="correo"
              value={form.correo}
              onChange={escribir('correo')}
              onBlur={alSalirCorreo}
              placeholder="Usuario"
              error={false}
              className="w-full"
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
            <p role="alert" className="mt-2 text-sm text-red-600">
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

          <p className="mt-4 text-sm text-center text-brand-ink/60">
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
              className="mt-4 text-sm leading-relaxed rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
            >
              {errorLogin}
            </p>
          ) : null}

          <p className="mt-4 text-xs leading-relaxed text-brand-ink/50">
            Al registrarte entras con permisos de solicitante: solo verás tus propias solicitudes. Si
            necesitas entrar al panel de administrador o al módulo de conductor, pídele a un
            administrador que suba tu rol.
          </p>
        </form>
      </div>
      </div>
    </Modal>
  )
}
