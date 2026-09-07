import { useState } from 'react'
import { MdNotificationsNone, MdNotificationsActive, MdClose, MdHistory, MdTag, MdAccessTime, MdPerson, MdArrowForward, MdVisibility } from 'react-icons/md'
import { getBadgeColor, getDotColor } from '../pages/Home/Components/estadoColors.js'

const VISTAS_KEY = 'ctp_notif_vistas'

function loadVistas() {
  try {
    return JSON.parse(localStorage.getItem(VISTAS_KEY) || '{}')
  } catch {
    return {}
  }
}

function persistVistas(v) {
  try {
    localStorage.setItem(VISTAS_KEY, JSON.stringify(v))
  } catch {
    // ignorar
  }
}

function notifKey(c) {
  return `${c.id}|${c.fecha}|${c.hora}|${c.campo}|${c.nuevo}`
}

export default function NotificationsPanel({ solicitudes }) {
  const [open, setOpen] = useState(false)
  const [vistas, setVistas] = useState(() => loadVistas())

  const changes = solicitudes
    .flatMap((s) =>
      (Array.isArray(s.historial) ? s.historial : []).map((h) => ({
        ...h,
        id: s.id,
        cliente: s.cliente,
        zona: s.zona,
      }))
    )
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
    .reverse()
    .map((c) => ({ ...c, key: notifKey(c) }))

  const total = changes.length
  const noVistas = changes.filter((c) => !vistas[c.key]).length

  const handleToggle = () => {
    if (!open) {
      const actuales = { ...loadVistas() }
      const ahora = new Date()
      const stamp = `${ahora.toLocaleDateString('es-CO')} ${ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
      changes.forEach((c) => {
        if (!actuales[c.key]) actuales[c.key] = stamp
      })
      persistVistas(actuales)
      setVistas(actuales)
    }
    setOpen(!open)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notificaciones"
        className="relative grid place-items-center size-11 rounded-full bg-brand-navy text-white hover:bg-brand-deep transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/70"
      >
        {open ? <MdNotificationsActive className="text-xl text-brand-cyan" /> : <MdNotificationsNone className="text-xl" />}
        {noVistas > 0 && (
          <span className="absolute -top-1 -right-1 grid place-items-center min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold ring-2 ring-white">
            {noVistas > 9 ? '9+' : noVistas}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed z-50 inset-x-3 top-20 max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl bg-white border border-brand-ink/10 shadow-2xl overflow-hidden origin-center animate-scaleIn sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[min(80vh,620px)] sm:w-[min(88vw,560px)] sm:origin-top-right">
            <div className="flex items-center justify-between px-4 py-3 bg-brand-navy text-white shrink-0">
              <span className="inline-flex items-center gap-2 text-sm font-extrabold">
                <MdNotificationsActive className="text-brand-cyan" />
                Notificaciones
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{total}</span>
              </span>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setOpen(false)}
                className="grid place-items-center size-7 rounded-full bg-white/10 hover:bg-white/20 transition"
              >
                <MdClose className="text-sm" />
              </button>
            </div>

            <div className="overflow-y-auto p-2">
              {total === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <MdHistory className="text-3xl text-brand-ink/20 mb-2" />
                  <p className="text-brand-ink/50 text-sm">Sin notificaciones de cambios</p>
                </div>
              ) : (
                changes.map((c, i) => (
                  <div key={c.key || i} className="rounded-xl border border-brand-ink/10 bg-white shadow-sm p-3 mb-2 animate-fadeIn">
                    <div className="flex items-start justify-between gap-2 w-full min-w-0">
                      <span className="flex min-w-0 flex-col items-start gap-0.5">
                        <span className="flex min-w-0 items-center gap-1.5 font-bold text-brand-deep text-sm">
                          <MdTag className="text-brand-cyan shrink-0" />
                          <span className="truncate">{c.id}</span>
                        </span>
                        <span className="hidden sm:inline max-w-full truncate text-brand-ink/60 font-semibold text-[11px]">
                          {c.cliente || '—'} · {c.zona || '—'}
                        </span>
                      </span>
                      <span className="shrink-0 flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1 text-brand-ink/50 text-[11px] whitespace-nowrap">
                          <MdAccessTime /> {c.fecha} · {c.hora}
                        </span>
                        {vistas[c.key] ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-deep/10 text-brand-deep px-2 py-0.5 text-[10px] font-bold">
                            <MdVisibility /> Vista · {vistas[c.key]}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-600 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
                            <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                            No vista
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {c.campo === 'estado' ? (
                        <>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${getBadgeColor(c.anterior)}`}>
                            <span className={`size-1.5 rounded-full ${getDotColor(c.anterior)}`} />
                            {c.anterior}
                          </span>
                          <MdArrowForward className="text-brand-ink/40" />
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${getBadgeColor(c.nuevo)}`}>
                            <span className={`size-1.5 rounded-full ${getDotColor(c.nuevo)}`} />
                            {c.nuevo}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="rounded-full bg-brand-ink/10 text-brand-ink/60 px-2.5 py-0.5 text-xs font-bold">{c.anterior}</span>
                          <MdArrowForward className="text-brand-ink/40" />
                          <span className="rounded-full bg-brand-deep/10 text-brand-deep px-2.5 py-0.5 text-xs font-bold">{c.nuevo}</span>
                        </>
                      )}
                      <span className="inline-flex items-center gap-1 text-brand-ink/50 text-[11px]">
                        <MdPerson /> {c.persona || '—'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}