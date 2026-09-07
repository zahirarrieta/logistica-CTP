import { useEffect } from 'react'
import { MdCheckCircle } from 'react-icons/md'
import { getBadgeColor, getDotColor } from '../pages/Home/Components/estadoColors.js'

export default function Toast({ estado, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2600)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed inset-x-0 top-4 z-[1100] flex justify-center px-4 animate-slideDown" role="status" aria-live="polite">
      <div
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-2xl ${getBadgeColor(estado)} ring-2 ring-white/40`}
      >
        <span className={`size-2.5 rounded-full ${getDotColor(estado)}`} />
        <MdCheckCircle className="text-lg" />
        Estado actualizado a «{estado}»
        <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(estado)} animate-ping`} />
      </div>
    </div>
  )
}