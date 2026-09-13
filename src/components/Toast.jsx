import { useEffect } from 'react'
import { MdCheckCircle, MdAssignmentInd } from 'react-icons/md'
import { RiSteering2Line } from 'react-icons/ri'
import { getBadgeColor, getDotColor } from '../pages/Home/Components/estadoColors.js'

export default function Toast({ tipo = 'estado', estado, asignadoA, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2600)
    return () => clearTimeout(timer)
  }, [onClose])

  const esAsignacion = tipo === 'asignado'
  const esConductor = tipo === 'conductor'

  const text = esConductor
    ? `Conductor asignado: «${asignadoA || '—'}»`
    : esAsignacion
      ? `Solicitud asignada a «${asignadoA || 'Sin asignar'}»`
      : `Estado actualizado a «${estado || '—'}»`

  const colorClass = esAsignacion || esConductor ? 'bg-brand-navy text-white' : estado ? getBadgeColor(estado) : 'bg-brand-cyan text-brand-ink'
  const dotClass = esAsignacion || esConductor ? 'bg-brand-cyan' : estado ? getDotColor(estado) : 'bg-brand-ink'

  return (
    <div className="fixed inset-x-0 top-4 z-[1100] flex justify-center px-4 animate-slideDown" role="status" aria-live="polite">
      <div
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-2xl ${colorClass} ring-2 ring-white/40`}
      >
        <span className={`size-2.5 rounded-full ${dotClass}`} />
        {esConductor ? <RiSteering2Line className="text-lg text-brand-cyan" /> : esAsignacion ? <MdAssignmentInd className="text-lg text-brand-cyan" /> : <MdCheckCircle className="text-lg" />}
        {text}
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass} animate-ping`} />
      </div>
    </div>
  )
}