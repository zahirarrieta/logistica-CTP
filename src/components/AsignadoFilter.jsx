import { useState } from 'react'
import { MdAssignmentInd, MdExpandMore, MdPersonOff } from 'react-icons/md'
import { nombreDeAsignado } from '../store/solicitudesStore.js'
import { SIN_ASIGNAR } from './filtrosConstants.js'

function initials(name) {
  if (!name) return ''
  const nombre = String(name).trim()
  if (!nombre) return ''
  return nombre
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function AsignadoFilter({ solicitudes, value, onChange }) {
  const [open, setOpen] = useState(false)

  const counts = solicitudes.reduce((acc, s) => {
    const a = nombreDeAsignado(s.asignadoA)
    if (!a) {
      acc[SIN_ASIGNAR] = (acc[SIN_ASIGNAR] || 0) + 1
      return acc
    }
    acc[a] = (acc[a] || 0) + 1
    return acc
  }, {})

  const total = solicitudes.length
  const hasUnassigned = counts[SIN_ASIGNAR] > 0
  const present = Object.keys(counts).filter((k) => k !== SIN_ASIGNAR).sort((a, b) => a.localeCompare(b))

  const select = (a) => {
    onChange(a === SIN_ASIGNAR ? SIN_ASIGNAR : a)
    setOpen(false)
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full bg-brand-navy text-white px-4 py-2 text-sm font-bold shadow-sm hover:bg-brand-deep transition-colors"
      >
        <MdAssignmentInd className="text-lg text-brand-cyan" />
        {value === SIN_ASIGNAR ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-deep/90 text-white px-2.5 py-0.5 text-xs font-bold">
            <MdPersonOff className="text-lg" />
            <span>Sin asignar</span>
            <span className="px-1 rounded-full bg-white/15">{counts[SIN_ASIGNAR] || 0}</span>
          </span>
        ) : value ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-deep/90 text-white px-2.5 py-0.5 text-xs font-bold">
            <span className="grid place-items-center size-4 rounded-full bg-white text-brand-deep text-[9px]">{initials(value)}</span>
            {value}
            <span className="px-1 rounded-full bg-white/15">{counts[value] || 0}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            Asignado
            <span className="px-1.5 rounded-full bg-white/15">{present.length + (hasUnassigned ? 1 : 0)}</span>
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
              className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${!value ? 'bg-brand-cyan/20' : 'hover:bg-brand-ink/5'}`}
            >
              <span className="inline-flex items-center gap-2">
                <MdAssignmentInd className="text-brand-cyan" />
                Todos
              </span>
              <span className="rounded-full bg-brand-ink/10 px-2 py-0.5 text-xs font-bold">{total}</span>
            </button>
            {hasUnassigned && (
              <button
                type="button"
                onClick={() => select(SIN_ASIGNAR)}
                className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${value === SIN_ASIGNAR ? 'bg-brand-cyan/20' : 'hover:bg-brand-ink/5'}`}
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <MdPersonOff className="text-brand-cyan text-lg" />
                  <span>Sin asignar</span>
                </span>
                <span className="rounded-full bg-brand-ink/10 px-2 py-0.5 text-xs font-bold">{counts[SIN_ASIGNAR]}</span>
              </button>
            )}
            {present.length > 0 ? (
              present.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => select(a)}
                  className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${value === a ? 'bg-brand-cyan/20' : 'hover:bg-brand-ink/5'}`}
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <span className="grid place-items-center size-7 shrink-0 rounded-full bg-brand-deep text-white text-xs font-extrabold">
                      {initials(a)}
                    </span>
                    <span className="truncate">{a}</span>
                  </span>
                  <span className="rounded-full bg-brand-ink/10 px-2 py-0.5 text-xs font-bold">{counts[a]}</span>
                </button>
              ))
            ) : !hasUnassigned ? (
              <p className="px-3 py-3 text-sm text-brand-ink/50 text-center">
                Aún no hay solicitudes asignadas
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}