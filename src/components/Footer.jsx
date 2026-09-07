export default function Footer() {
  return (
    <footer className="bg-brand-ink text-brand-mist py-7 sm:py-9 shadow-[inset_0_1px_0_rgba(0,229,255,0.15),0_-12px_40px_rgba(0,0,0,0.4)] mt-auto relative overflow-hidden">
      {/* Glow decorativo superior */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-px bg-gradient-to-r from-transparent via-brand-cyan/50 to-transparent" aria-hidden />
      <div className="mx-auto w-full max-w-[min(1280px,95vw)] px-5 relative">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <p className="text-brand-mist/90 text-xs sm:text-sm order-2 sm:order-1 w-full sm:w-auto text-center sm:text-left">© 2026 CTP MEDICA S.A. | Todos los derechos reservados</p>
          <div className="flex gap-5 sm:gap-6 order-1 sm:order-2 w-full sm:w-auto justify-center sm:justify-end">
            <a href="#guia" className="font-bold text-brand-cyan transition-all duration-200 hover:text-brand-cyanSoft hover:[text-shadow:0_0_14px_rgba(0,229,255,0.8)]">Guía</a>
            <a href="#instructivo" className="font-bold text-brand-cyan transition-all duration-200 hover:text-brand-cyanSoft hover:[text-shadow:0_0_14px_rgba(0,229,255,0.8)]">Instructivo</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
