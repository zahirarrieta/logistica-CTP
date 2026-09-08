import { useEffect } from 'react'
import { MdCheckCircle } from 'react-icons/md'
import { getBadgeColor, getDotColor } from '../pages/Home/Components/estadoColors.js'

export default function Toast({ estado, mensaje, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2600)
    return () => clearTimeout(timer)
  }, [onClose])

  const text = mensaje ?? `Estado actualizado a «${estado}»`
  const colorClass = estado ? getBadgeColor(estado) : 'bg-brand-cyan text-brand-ink'
  const dotClass = estado ? getDotColor(estado) : 'bg-brand-ink'

  return (
    <div className="fixed inset-x-0 top-4 z-[1100] flex justify-center px-4 animate-slideDown" role="status" aria-live="polite">
      <div
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-2xl ${colorClass} ring-2 ring-white/40`}
      >
        <span className={`size-2.5 rounded-full ${dotClass}`} />
        <MdCheckCircle className="text-lg" />
        {text}
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass} animate-ping`} />
      </div>
    </div>
  )
}