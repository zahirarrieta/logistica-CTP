import { useEffect, useState } from 'react'
import { MdCloudOff } from 'react-icons/md'

export default function IndicadorSinConexion() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const conectar = () => setOnline(true)
    const desconectar = () => setOnline(false)
    window.addEventListener('online', conectar)
    window.addEventListener('offline', desconectar)
    return () => {
      window.removeEventListener('online', conectar)
      window.removeEventListener('offline', desconectar)
    }
  }, [])

  if (online) return null

  return (
    <div
      className="fixed inset-x-0 top-4 z-[1090] flex justify-center px-4 animate-slideDown pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-2xl bg-amber-400 text-amber-950 ring-2 ring-white/40">
        <span className="size-2.5 rounded-full bg-amber-950" />
        <MdCloudOff className="text-lg" />
        Sin conexión · guardando en borrador
        <span className="w-1.5 h-1.5 rounded-full bg-amber-950 animate-ping" />
      </div>
    </div>
  )
}
