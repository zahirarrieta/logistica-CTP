import { useState } from 'react'
import { MdLocalShipping, MdExpandMore } from 'react-icons/md'

export default function ConductorFilter({ solicitudes, value, onChange }) {
  const [open, setOpen] = useState(false)

  const counts = solicitudes.reduce((acc, s) => {
    const c = String(s.conductor || '').trim()
    if (!c) return acc
    acc[c] = (acc[c] || 0) + 1
    return acc
  }, {})

  const present = Object.keys(counts).sort((a, b) => a.localeCompare(b))

  const select = (c) => {
    onChange(c)
    setOpen(false)
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full bg-brand-navy text-white px-4 py-2 text-sm font-bold shadow-sm hover:bg-brand-deep transition-colors"
      >
        <MdLocalShipping className="text-lg text-amber-400" />
        {value ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/90 text-white px-2.5 py-0.5 text-xs font-bold">
            {value}
            <span className="px-1 rounded-full bg-white/15">{counts[value] || 0}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            Conductor
            <span className="px-1.5 rounded-full bg-white/15">{present.length}</span>
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
              className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${!value ? 'bg-amber-500/20' : 'hover:bg-brand-ink/5'}`}
            >
              <span className="inline-flex items-center gap-2">
                <MdLocalShipping className="text-amber-400" />
                Todos
              </span>
              <span className="rounded-full bg-brand-ink/10 px-2 py-0.5 text-xs font-bold">{solicitudes.length}</span>
            </button>
            {present.length > 0 ? (
              present.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => select(c)}
                  className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${value === c ? 'bg-amber-500/20' : 'hover:bg-brand-ink/5'}`}
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <span className="grid place-items-center size-7 shrink-0 rounded-full bg-amber-500 text-white text-xs font-extrabold">
                      {c.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate">{c}</span>
                  </span>
                  <span className="rounded-full bg-brand-ink/10 px-2 py-0.5 text-xs font-bold">{counts[c]}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-sm text-brand-ink/50 text-center">
                Aún no hay conductores asignados
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}