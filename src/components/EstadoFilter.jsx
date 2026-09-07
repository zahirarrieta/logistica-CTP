import { useState } from 'react'
import { MdFilterList, MdExpandMore } from 'react-icons/md'
import { getBadgeColor, getDotColor } from '../pages/Home/Components/estadoColors.js'

const ESTADOS = [
  'Abierto',
  'Autorizado',
  'Cancelado',
  'Cerrado',
  'Devolución Solicitante',
  'En alistamiento',
  'Entregado',
  'Entregado/Parcial',
  'En Transito',
  'En Tramite',
  'Despacho Parcial',
]

export default function EstadoFilter({ solicitudes, value, onChange }) {
  const [open, setOpen] = useState(false)

  const counts = solicitudes.reduce((acc, s) => {
    const e = s.estado || 'Abierto'
    acc[e] = (acc[e] || 0) + 1
    return acc
  }, {})

  const total = solicitudes.length
  const present = ESTADOS.filter((e) => (counts[e] || 0) > 0)

  const select = (e) => {
    onChange(e)
    setOpen(false)
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full bg-brand-navy text-white px-4 py-2 text-sm font-bold shadow-sm hover:bg-brand-deep transition-colors"
      >
        <MdFilterList className="text-lg text-brand-cyan" />
        {value ? (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${getBadgeColor(value)}`}>
            <span className={`size-2 rounded-full ${getDotColor(value)}`} />
            {value}
            <span className="px-1 rounded-full bg-black/10">{counts[value] || 0}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            Todos
            <span className="px-1.5 rounded-full bg-white/15">{total}</span>
          </span>
        )}
        <MdExpandMore className={`text-lg transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-full mt-2 z-50 w-72 max-h-80 overflow-y-auto rounded-2xl bg-white border border-brand-ink/10 shadow-xl p-2 animate-scaleIn origin-top-left">
            <button
              type="button"
              onClick={() => select(null)}
              className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                !value ? 'bg-brand-navy text-white shadow-sm' : 'hover:bg-brand-ink/5 text-brand-ink'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <MdFilterList className="text-brand-cyan" />
                Todos
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${!value ? 'bg-white/15' : 'bg-brand-ink/10'}`}>{total}</span>
            </button>
            {present.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => select(e)}
                className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-all ${getBadgeColor(e)} ${
                  value === e ? 'ring-2 ring-brand-deep/40 shadow-sm scale-[1.02]' : 'hover:brightness-95'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${getDotColor(e)}`} />
                  {e}
                </span>
                <span className="rounded-full bg-white/60 text-brand-ink/70 px-2 py-0.5 text-xs font-bold">{counts[e]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}