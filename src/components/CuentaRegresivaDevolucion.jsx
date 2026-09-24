import { useState, useEffect } from 'react'
import { MdTimer, MdTimerOff } from 'react-icons/md'
import { restanteDevolucion } from '../pages/Home/Components/solicitudesStore.js'

// Formatea milisegundos como «4:32» (min:seg).
function formatearMs(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Cuenta regresiva de la ventana de corrección (5 minutos). Si se pasa «ahora»
// (ms), el conteo lo controla el padre; si no, la pestaña hace su propio tick.
// Vencida muestra un estado visual distinto. Retorna null si la solicitud no
// está en devolución.
export default function CuentaRegresivaDevolucion({ solicitud, ahora, compacto = false, className = '' }) {
  const [local, setLocal] = useState(() => Date.now())
  useEffect(() => {
    if (ahora !== undefined) return undefined
    const id = setInterval(() => setLocal(Date.now()), 1000)
    return () => clearInterval(id)
  }, [ahora])

  const t = ahora !== undefined ? ahora : local
  const restante = restanteDevolucion(solicitud, t)
  if (restante === null) return null

  const vencida = restante === 0
  const critico = !vencida && restante < 60000

  if (vencida) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-slate-200 text-slate-500 px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap ${className}`}>
        <MdTimerOff className="text-sm" />
        {compacto ? 'VENCIDA' : 'TIEMPO DE CORRECCIÓN VENCIDO'}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-extrabold whitespace-nowrap ${
        critico
          ? 'bg-red-100 text-red-700 px-2.5 py-1 text-[11px] animate-pulse'
          : 'bg-brand-cyan/15 text-brand-deep px-2.5 py-1 text-[11px]'
      } ${className}`}
      title="Tiempo restante para corregir y reenviar la solicitud"
    >
      <MdTimer className="text-sm" />
      {compacto ? formatearMs(restante) : `${formatearMs(restante)} para corregir`}
    </span>
  )
}