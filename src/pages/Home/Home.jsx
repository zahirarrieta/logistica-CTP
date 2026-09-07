import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdClose, MdSend } from 'react-icons/md'
import { FiTruck } from 'react-icons/fi'
import Header from '../../components/Header.jsx'
import Footer from '../../components/Footer.jsx'
import SolicitudModal from './Components/modals/SolicitudModal.jsx'
import { saveSolicitud } from './Components/solicitudesStore.js'



const ASSETS = {
  logo: '/public/CTPM.png',
  heroImages: [
    '/public/Principal/PEDRO.png',
    '/public/Principal/PRY-590.png',
    '/public/Principal/CARDIO.png',
    '/public/Principal/MUNDO.png',
  ],
}

const TAGS = ['Última milla', 'Cargas especiales', 'Cobertura nacional']

function Home() {
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [solicitudModalOpen, setSolicitudModalOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
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

  const handleModalSubmit = (e) => {
    e.preventDefault()
    // Aquí iría la lógica de autenticación
    console.log('Email:', email, 'Remember:', rememberMe)
    setShowModal(false)
  }

  const handleNewSolicitud = (data) => {
    saveSolicitud(data)
    setSolicitudModalOpen(false)
    navigate('/solicitudes')
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-brand-ink text-white">
      {/* Card oscura contenedor (Header + Hero) */}
      <div className="relative overflow-hidden bg-hero-dark text-white rounded-b-[32px] shadow-[0_24px_60px_rgba(0,0,0,0.45)] animate-slideDown">
        {/* Resplandores cian sutiles de fondo */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-brand-cyan/15 blur-[120px]" />
          <div className="absolute bottom-0 -left-24 w-[380px] h-[380px] rounded-full bg-brand-deep/50 blur-[100px]" />
          <div className="absolute top-1/3 left-1/2 w-[300px] h-[300px] -translate-x-1/2 rounded-full bg-brand-cyan/8 blur-[90px]" />
        </div>

        <Header />

        {/* Hero Section */}
        <main className="pt-[clamp(0.75rem,3vw,2.5rem)] pb-[clamp(2rem,7vw,5rem)] relative md:min-h-[60vh] xl:min-h-[70vh] 2xl:min-h-[75vh] max-h-[90vh]">
          <div className="mx-auto w-full max-w-[min(1680px,88vw)] px-5">
            {/* Card unificado para texto + carrusel */}
            <div className="relative rounded-[2rem] bg-white/[0.04] backdrop-blur-md ring-1 ring-brand-cyan/15 shadow-2xl p-5 sm:p-7 md:p-8 overflow-hidden">
              {/* Borde superior con degradado cian */}
              <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/60 to-transparent" />
              <div className="grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] xl:grid-cols-[1fr_1fr] items-center gap-8 sm:gap-10">
                <section className="text-white relative z-[1]">
                  <span className="inline-flex items-center gap-2 rounded-full bg-brand-cyan/10 ring-1 ring-brand-cyan/30 px-3 py-1.5 text-[clamp(0.65rem,1.6vw,0.9rem)] font-semibold tracking-wide text-brand-cyan">
                    <span className="size-2 rounded-full bg-brand-cyan shadow-cyanGlow" />
                    Servicio nacional 
                  </span>
                  <h1 className="mt-4 font-display text-[clamp(2.4rem,5.8vw,6rem)] leading-[0.9] font-black text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                    <span className="block">BIENVENIDO</span>
                    <span className="block relative bg-gradient-to-r from-brand-cyan via-brand-cyanSoft to-brand-cyan bg-clip-text text-transparent text-[clamp(1.6rem,4.4vw,4.2rem)]">
                      ADMINISTRADOR
                      <span aria-hidden className="absolute -inset-x-1 -bottom-1 h-2 bg-gradient-to-r from-brand-cyan/40 via-brand-cyan/60 to-brand-cyan/40 blur-md" />
                    </span>
                  </h1>
                  <h2 className="mt-3 sm:mt-4 text-[clamp(1rem,2.2vw,1.7rem)] font-extrabold text-brand-mist drop-shadow-[0_4px_14px_rgba(0,0,0,0.4)]">
                    LOGISTICA Y TRANSPORTE
                  </h2>
                  <div className="mt-6 flex flex-wrap gap-2 opacity-95">
                    {TAGS.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-full bg-white/[0.06] ring-1 ring-brand-cyan/25 text-brand-mist text-[12px] font-semibold backdrop-blur-sm transition-colors duration-200 hover:bg-brand-cyan/15 hover:text-brand-cyan"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-8 sm:mt-10 flex flex-wrap justify-start gap-3">
                    <button
                      type="button"
                      onClick={() => setSolicitudModalOpen(true)}
                      className="group relative inline-flex items-center justify-center rounded-2xl px-10 py-4 font-extrabold text-brand-ink bg-gradient-to-br from-brand-cyan to-brand-cyanSoft shadow-cyanGlow transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,229,255,0.6)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-cyan/40"
                    >
                      <span className="relative z-10 flex w-full items-center gap-3 transition-all duration-500 group-hover:gap-10">
                        <img
                          src="/public/Principal/PRY-590.png"
                          alt="Truck"
                          className="order-1 w-7 h-7 object-contain transition-all duration-500 ease-out group-hover:order-2 group-hover:ml-auto group-hover:translate-x-4 group-hover:scale-110 group-hover:drop-shadow-[0_6px_12px_rgba(0,0,0,0.25)] group-hover:animate-truckMove"
                        />
                        <span className="order-2 flex flex-col items-center tracking-wide text-brand-ink">
                          NUEVA SOLICITUD
                          <span className="mt-1 h-[3px] w-0 rounded-full bg-brand-ink/50 transition-all duration-300 group-hover:w-full group-hover:bg-brand-ink" />
                        </span>
                      </span>
                    </button>
                  </div>
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
                      {/* Halo cian sutil alrededor del carrusel */}
                      <div aria-hidden className="absolute inset-[-10%] rounded-full bg-brand-cyan/12 blur-[80px] pointer-events-none" />
                      {/* Viewport fijo para evitar saltos por tamaños distintos */}
                      <div className="relative w-[min(95vw,900px)] md:w-[clamp(500px,50vw,1000px)] xl:w-[clamp(600px,45vw,1100px)] 2xl:w-[clamp(700px,40vw,1200px)] max-w-full min-h-[280px] md:min-h-[400px] xl:min-h-[480px] flex items-center justify-center">
                        {ASSETS.heroImages.map((src, idx) => (
                          <img
                            key={src}
                            src={src}
                            alt={`Slide ${idx + 1}`}
                            loading={idx === 0 ? 'eager' : 'lazy'}
                            decoding="async"
                            className={`absolute inset-0 m-auto max-h-full max-w-full object-contain transition-all duration-500 ease-out ${
                              idx === currentSlide
                                ? 'opacity-100 scale-100 blur-0 drop-shadow-[0_0_40px_rgba(0,229,255,0.30)]'
                                : 'opacity-0 scale-[1.02] blur-[1px]'
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

      {/* Modal de Acceso Restringido */}
      {showModal && (
        <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 animate-fadeIn" onClick={() => setShowModal(false)}>
          <div className="relative bg-white text-[#333] w-full max-w-[420px] rounded-2xl shadow-2xl p-5 sm:p-6 animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <button aria-label="Cerrar" className="absolute top-3 right-3 w-8 h-8 grid place-items-center text-[#666] hover:bg-[#f0f0f0] rounded-full transition" onClick={() => setShowModal(false)}>
              <MdClose className="text-xl" />
            </button>
            <h3 className="text-lg sm:text-xl font-bold text-center mb-4 sm:mb-5">ACCESO RESTRINGIDO</h3>
            <form onSubmit={handleModalSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-medium text-[#555]" htmlFor="email">Correo Electrónico</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="px-3 py-2.5 border-2 border-[#ddd] rounded-lg focus:outline-none focus:border-[#00E5FF]"
                />
              </div>
              <label htmlFor="remember" className="inline-flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4"
                />
                <span className="text-[#555]">Recuérdame</span>
              </label>
              <button type="submit" className="mt-2 bg-gradient-to-r from-[#00E5FF] to-[#003B73] text-brand-ink font-semibold rounded-lg py-2.5 hover:-translate-y-0.5 transition shadow-md">
                REGISTRAR
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
      <SolicitudModal
        open={solicitudModalOpen}
        onClose={() => setSolicitudModalOpen(false)}
        onSubmit={handleNewSolicitud}
      />
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

export default Home
