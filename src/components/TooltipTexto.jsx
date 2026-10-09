import { cloneElement, isValidElement, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Muestra un globo con estilo propio cuando el texto queda recortado (truncate),
// en lugar del tooltip nativo del navegador (cuadrado y sin estilo). Se envuelve
// un solo elemento hijo (span, input, etc.) y se le conectan los eventos del
// ratón. El globo se monta en un portal sobre <body> porque los desplegables
// llevan `animate-scaleIn` (un transform que convierte al contenedor en el
// bloque del `fixed`) y su `overflow-hidden` recortaría el globo.
export default function TooltipTexto({ texto, children }) {
  const [pos, setPos] = useState(null)

  const entrar = (e) => {
    const el = e.currentTarget
    if (!el || !texto) return
    if (el.scrollWidth <= el.clientWidth + 1) return
    const r = el.getBoundingClientRect()
    setPos({ x: r.left + r.width / 2, y: r.bottom + 10 })
  }
  const salir = () => setPos(null)

  useEffect(() => {
    if (!pos) return
    const ocultar = () => setPos(null)
    window.addEventListener('scroll', ocultar, true)
    window.addEventListener('resize', ocultar)
    return () => {
      window.removeEventListener('scroll', ocultar, true)
      window.removeEventListener('resize', ocultar)
    }
  }, [pos])

  if (!isValidElement(children)) return children

  const hijo = cloneElement(children, {
    onMouseEnter: (e) => {
      children.props?.onMouseEnter?.(e)
      entrar(e)
    },
    onMouseLeave: (e) => {
      children.props?.onMouseLeave?.(e)
      salir()
    },
  })

  return (
    <>
      {hijo}
      {pos &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[1300] max-w-xs -translate-x-1/2 rounded-xl bg-brand-navy px-3 py-2 text-xs font-semibold leading-snug text-white shadow-2xl ring-1 ring-white/20 animate-scaleIn"
            style={{ left: pos.x, top: pos.y }}
          >
            <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rotate-45 rounded-[2px] bg-brand-navy" />
            {texto}
          </span>,
          document.body
        )}
    </>
  )
}
