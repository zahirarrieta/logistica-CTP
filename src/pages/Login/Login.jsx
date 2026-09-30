import { useEffect, useRef, useState } from 'react'
import { MdLogin } from 'react-icons/md'
import { FiTruck } from 'react-icons/fi'
import Footer from '../../components/Footer.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import RegistroModal from './RegistroModal.jsx'
import './login.css'

const ASSETS = {
  logo: '/CTPM.png',
  heroImages: [
    '/Principal/PEDRO.png',
    '/Principal/PRY-590.png',
    '/Principal/KWL-381.png',
    '/Principal/CARDIO.png',
    '/Principal/MUNDO.png',
  ],
}

const TAGS = ['Última milla', 'Cargas especiales', 'Cobertura nacional', 'Logística inversa']

// Esta pantalla es solo para entrar. El alta de cuenta va en un modal aparte:
// casi todo el mundo viene a iniciar sesión, y quien sí viene a registrarse no
// debería tener que cambiar el formulario de sitio para hacerlo.
function Login() {
  const { login, errorLogin, loginEnCurso, sesionCaducada, limpiarAviso } = useAuth()
  const [registroAbierto, setRegistroAbierto] = useState(false)
  const [form, setForm] = useState({ correo: '', contrasena: '' })
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const touchStartXRef = useRef(null)
  const touchEndXRef = useRef(null)

  const totalSlides = ASSETS.heroImages?.length || 0
  const goPrev = () => setCurrentSlide((prev) => (totalSlides ? (prev - 1 + totalSlides) % totalSlides : 0))
  const goNext = () => setCurrentSlide((prev) => (totalSlides ? (prev + 1) % totalSlides : 0))

  useEffect(() => {
    if (!totalSlides || isPaused) return
    const id = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides)
    }, 5000)
    return () => clearInterval(id)
  }, [totalSlides, isPaused])

  // El aviso se borra al escribir, para que no se quede ahí mientras el usuario
  // corrige lo que estaba mal.
  const escribir = (campo) => (e) => {
    if (errorLogin) limpiarAviso?.()
    setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  const enviar = (e) => {
    e.preventDefault()
    if (loginEnCurso) return
    login({ correo: form.correo, contrasena: form.contrasena })
  }

  const abrirRegistro = () => {
    limpiarAviso?.()
    setRegistroAbierto(true)
  }

  const rotulo = loginEnCurso ? 'ENTRANDO…' : 'INICIAR SESIÓN'
  // Con el modal abierto, el error se lee dentro de él: repetirlo detrás del
  // velo solo haría ruido.
  const avisoEnPagina = !registroAbierto && (errorLogin || sesionCaducada)

  const clasesCampo =
    'w-full rounded-xl border border-brand-cyan/25 bg-black/25 px-4 py-3 text-brand-mist ' +
    'placeholder:text-brand-mist/40 outline-none transition focus:border-brand-cyan/70 ' +
    'focus:ring-2 focus:ring-brand-cyan/25'

  return (
    <div className="min-h-screen flex flex-col font-sans bg-brand-ink text-white">
        {/* Card oscura contenedor, igual que el Home. `flex-1` para que ocupe
            el alto que sobra y el `main` de dentro pueda centrar el card. */}
        <div className="relative flex-1 flex flex-col overflow-hidden bg-hero-dark text-white rounded-b-[32px] shadow-[0_24px_60px_rgba(0,0,0,0.45)] animate-slideDown">
        {/* Resplandores cian sutiles de fondo */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-brand-cyan/15 blur-[120px]" />
          <div className="absolute bottom-0 -left-24 w-[380px] h-[380px] rounded-full bg-brand-deep/50 blur-[100px]" />
          <div className="absolute top-1/3 left-1/2 w-[300px] h-[300px] -translate-x-1/2 rounded-full bg-brand-cyan/8 blur-[90px]" />
        </div>

        {/* Logo pequeño arriba a la izquierda. Antes ocupaba casi 100px y
            empujaba el card hacia abajo; aquí solo marca la cabecera. */}
        <div className="flex justify-start pt-4 sm:pt-5 max-lg:pt-3 ps-6 sm:ps-8 max-lg:ps-6">
          <img
            src="/CTP.png"
            alt="CTP"
            className="h-[clamp(32px,4vw,48px)] max-lg:h-[clamp(28px,6vw,40px)] object-contain"
          />
        </div>

        {/* El card se centra en el hueco que queda entre el logo y el footer.
            Los `vh` de antes (min-h 46-56vh + max-h 82vh) lo hundían y, al
            recortarlo, el contenido se salía de la caja y el footer lo tapaba. */}
        <main className="relative flex-1 flex items-center w-full py-[clamp(0.75rem,2vw,1.5rem)]">
          <div className="mx-auto w-full max-w-[min(1680px,88vw)] px-5">
            <div className="relative rounded-[2rem] bg-white/[0.04] backdrop-blur-md ring-1 ring-brand-cyan/15 shadow-2xl p-5 sm:p-7 lg:p-8 max-lg:p-6 overflow-hidden">
              <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/60 to-transparent" />
              <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] xl:grid-cols-[1fr_1fr] items-center gap-8 sm:gap-10 max-lg:gap-6">
                <section className="text-white relative z-[1]">
                  <span className="inline-flex items-center gap-2 rounded-full bg-brand-cyan/10 ring-1 ring-brand-cyan/30 px-3 py-1.5 text-[clamp(0.65rem,1.6vw,0.9rem)] font-semibold tracking-wide text-brand-cyan login-enter">
                    <span className="size-2 rounded-full bg-brand-cyan shadow-cyanGlow" />
                    Acceso restringido
                  </span>
                  <h1 className="mt-4 font-display text-[clamp(2.4rem,5.8vw,6rem)] max-lg:text-[clamp(1.9rem,4.4vw,2.7rem)] leading-[0.9] font-black text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.4)] login-enter">
                    <span className="block">BIENVENIDO A</span>
                    <span className="block relative bg-gradient-to-r from-brand-cyan via-brand-cyanSoft to-brand-cyan bg-clip-text text-transparent">
                      PEDRO
                      <span aria-hidden className="absolute -inset-x-1 -bottom-1 h-2 bg-gradient-to-r from-brand-cyan/40 via-brand-cyan/60 to-brand-cyan/40 blur-md" />
                    </span>
                  </h1>
                  <h2 className="mt-3 sm:mt-4 text-[clamp(1rem,2.2vw,1.7rem)] max-lg:text-[clamp(1rem,2.1vw,1.25rem)] font-extrabold text-brand-mist drop-shadow-[0_4px_14px_rgba(0,0,0,0.4)] login-enter">
                    LOGÍSTICA Y TRANSPORTE
                  </h2>
                  <span className="mt-4 max-lg:mt-3 inline-flex items-center gap-2 rounded-full bg-brand-cyan/10 ring-1 ring-brand-cyan/30 px-3 py-1.5 text-[clamp(0.65rem,1.6vw,0.9rem)] font-semibold tracking-wide text-brand-cyan login-enter">
                    <span className="size-2 rounded-full bg-brand-cyan shadow-cyanGlow" />
                    SERVICIO NACIONAL
                  </span>
                  <div className="mt-6 max-lg:mt-4 flex flex-wrap gap-2 opacity-95 login-enter">
                    {TAGS.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-full bg-white/[0.06] ring-1 ring-brand-cyan/25 text-brand-mist text-[12px] font-semibold backdrop-blur-sm transition-colors duration-200 hover:bg-brand-cyan/15 hover:text-brand-cyan"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Formulario. El `onSubmit` en vez de `onClick` en el botón
                      permite mandar con Enter, que es como se rellena un formulario
                      de verdad. */}
                  <form onSubmit={enviar} className="mt-8 sm:mt-10 max-lg:mt-6 max-w-lg login-enter">
                    <div className="grid gap-3">
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
                        className={clasesCampo}
                      />

                      <input
                        type="password"
                        name="contrasena"
                        // `current-password` porque esta cuenta ya existe: el
                        // gestor puede ofrecer la clave sin sorprender a nadie.
                        autoComplete="current-password"
                        required
                        maxLength={200}
                        value={form.contrasena}
                        onChange={escribir('contrasena')}
                        placeholder="Contraseña"
                        aria-label="Contraseña"
                        className={clasesCampo}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loginEnCurso}
                      className="group relative mt-5 inline-flex w-full items-center justify-center rounded-2xl px-10 py-4 max-lg:px-8 max-lg:py-3.5 font-extrabold text-brand-ink bg-gradient-to-br from-brand-cyan to-brand-cyanSoft shadow-cyanGlow transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,229,255,0.6)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-cyan/40 disabled:opacity-60 disabled:cursor-wait disabled:hover:translate-y-0"
                    >
                      <span className="login-cta-ring" aria-hidden="true" />
                      <span className="relative z-10 flex w-full items-center justify-center gap-3 tracking-wide text-brand-ink">
                        <MdLogin className="login-lock text-2xl" />
                        <span className="flex flex-col items-center tracking-wide text-brand-ink">
                          {rotulo}
                          <span className="mt-1 h-[3px] w-0 rounded-full bg-brand-ink/50 transition-all duration-300 group-hover:w-full group-hover:bg-brand-ink" />
                        </span>
                      </span>
                    </button>

                    {/* El alta no es un segundo modo del formulario sino un paso
                        aparte: se entra en él con este enlace y se vuelve atrás
                        cerrando el modal. */}
                    <p className="mt-4 text-sm text-brand-mist/80">
                      ¿Todavía no tienes cuenta?{' '}
                      <button
                        type="button"
                        onClick={abrirRegistro}
                        className="font-bold text-brand-cyan underline underline-offset-4 hover:text-brand-cyanSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40 rounded"
                      >
                        Regístrate aquí
                      </button>
                    </p>
                  </form>

                  {avisoEnPagina ? (
                    <p
                      role="alert"
                      className="mt-4 max-w-xl text-sm leading-relaxed rounded-xl border border-red-400/40 bg-red-950/40 px-4 py-3 text-red-100"
                    >
                      {errorLogin || sesionCaducada}
                    </p>
                  ) : null}
                </section>

                <section className="relative flex justify-center w-full z-[1]">
                  {totalSlides > 0 ? (
                    <div
                      className="relative w-full flex items-center justify-center"
                      onMouseEnter={() => setIsPaused(true)}
                      onMouseLeave={() => setIsPaused(false)}
                      onTouchStart={(e) => { touchStartXRef.current = e.changedTouches[0].clientX; touchEndXRef.current = null }}
                      onTouchMove={(e) => { touchEndXRef.current = e.changedTouches[0].clientX }}
                      onTouchEnd={() => {
                        const start = touchStartXRef.current; const end = touchEndXRef.current
                        if (start == null || end == null) return
                        const delta = end - start
                        if (Math.abs(delta) > 40) { delta < 0 ? goNext() : goPrev() }
                      }}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'ArrowLeft') goPrev(); if (e.key === 'ArrowRight') goNext() }}
                      role="region"
                      aria-label="Carrusel de imágenes"
                    >
                      <div aria-hidden className="absolute inset-[-10%] rounded-full bg-brand-cyan/12 blur-[80px] pointer-events-none" />
                      <div className="relative w-[min(95vw,900px)] max-lg:w-[min(48vw,340px)] lg:w-[clamp(500px,50vw,1000px)] xl:w-[clamp(600px,45vw,1100px)] 2xl:w-[clamp(700px,40vw,1200px)] max-w-full min-h-[280px] max-lg:min-h-[210px] lg:min-h-[400px] xl:min-h-[480px] aspect-[5/4] flex items-center justify-center">
                        {ASSETS.heroImages.map((src, idx) => (
                          <img
                            key={src}
                            src={src}
                            alt={`Slide ${idx + 1}`}
                            loading={idx === 0 ? 'eager' : 'lazy'}
                            decoding="async"
className={`absolute inset-0 m-auto max-h-full max-w-full object-contain transition-opacity duration-500 ease-out ${
  idx === currentSlide
    ? 'opacity-100 drop-shadow-[0_0_40px_rgba(0,229,255,0.30)]'
    : 'opacity-0'
}`}
                            sizes="(max-width: 768px) 95vw, (max-width: 1280px) 50vw, (max-width: 1536px) 45vw, 40vw"
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full max-w-[560px] h-[360px] border-2 border-brand-cyan/25 rounded-2xl flex items-center justify-center bg-white/5">
                      <span className="text-brand-mist/70">Sin imágenes</span>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>

      <Footer />

      {registroAbierto ? <RegistroModal onClose={() => setRegistroAbierto(false)} /> : null}

      {/* Botón flotante CTP */}
      <a
        href="https://www.ctpmedica.net/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="CTP"
        className="inline-flex items-center justify-center rounded-full bg-brand-cyan text-brand-ink shadow-[0_15px_30px_rgba(0,0,0,0.4),0_5px_18px_rgba(0,229,255,0.5)] ring-4 ring-brand-cyan/25 hover:scale-110 hover:shadow-[0_20px_40px_rgba(0,0,0,0.5),0_8px_26px_rgba(0,229,255,0.65)] transition-all duration-300 relative pointer-events-auto w-[clamp(2.75rem,6vw,3.5rem)] h-[clamp(2.75rem,6vw,3.5rem)] transform hover:-translate-y-1"
        style={{ position: 'fixed', right: 'calc(env(safe-area-inset-right, 0px) + clamp(0.5rem, 3vw, 1.5rem))', bottom: 'calc(env(safe-area-inset-bottom, 0px) + clamp(0.5rem, 3vw, 1.5rem))', left: 'auto', top: 'auto', zIndex: 9999 }}
      >
        <span className="absolute inset-0 rounded-full bg-brand-cyan opacity-40 animate-ping" />
        {ASSETS.logo ? (
          <img src={ASSETS.logo} alt="CTP" className="object-contain w-[75%] h-[75%]" />
        ) : (
          <span className="font-extrabold tracking-wide"><FiTruck className="text-2xl" /></span>
        )}
      </a>
    </div>
  )
}

export default Login
