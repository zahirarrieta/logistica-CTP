import { useState, useEffect } from 'react'
import {
  MdNotificationsNone,
  MdNotificationsActive,
  MdClose,
  MdHistory,
  MdTag,
  MdAccessTime,
  MdPerson,
  MdArrowForward,
  MdVisibility,
  MdCheckCircle,
  MdAssignmentInd,
  MdExpandMore,
  MdChevronLeft,
  MdChevronRight,
} from 'react-icons/md'
import { getBadgeColor, getDotColor } from '../pages/Home/Components/estadoColors.js'
import { safeText } from '../pages/Home/Components/solicitudesStore.js'

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

function changeText(value) {
  return safeText(value)
}

function ItemHeader({ c, i, total, vistas }) {
  return (
    <div className="flex items-start justify-between gap-2 w-full min-w-0">
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5 font-bold text-brand-deep text-sm">
          <span className="shrink-0 grid place-items-center size-6 rounded-full bg-brand-navy text-white text-[11px] font-extrabold">
            {total - i}
          </span>
          <MdTag className="text-brand-cyan shrink-0" />
          <span className="truncate">{c.id}</span>
        </span>
        <span className="hidden sm:inline max-w-full truncate text-brand-ink/60 font-semibold text-[11px]">
          {changeText(c.cliente) || '—'} · {changeText(c.zona) || '—'}
        </span>
      </span>
      <span className="shrink-0 flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1 text-brand-ink/50 text-[11px] whitespace-nowrap">
          <MdAccessTime /> {changeText(c.fecha)} · {changeText(c.hora)}
        </span>
        {vistas[c.key] ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-deep/10 text-brand-deep px-2 py-0.5 text-[10px] font-bold">
            <MdVisibility /> Vista
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-600 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
            <span className="size-1.5 rounded-full bg-red-500 animate-pulse" /> No vista
          </span>
        )}
      </span>
    </div>
  )
}

function ItemBody({ c }) {
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {c.campo === 'estado' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-cyan/15 text-brand-deep px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
            <MdCheckCircle /> Cambio de estado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-deep/10 text-brand-deep px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
            <MdAssignmentInd /> Asignación de usuario
          </span>
        )}
        {c.campo === 'estado' ? (
          <>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${getBadgeColor(changeText(c.anterior))}`}>
              <span className={`size-1.5 rounded-full ${getDotColor(changeText(c.anterior))}`} />
              {changeText(c.anterior)}
            </span>
            <MdArrowForward className="text-brand-ink/40" />
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${getBadgeColor(changeText(c.nuevo))}`}>
              <span className={`size-1.5 rounded-full ${getDotColor(changeText(c.nuevo))}`} />
              {changeText(c.nuevo)}
            </span>
          </>
        ) : (
          <>
            <span className="rounded-full bg-brand-ink/10 text-brand-ink/60 px-2.5 py-0.5 text-xs font-bold">{changeText(c.anterior)}</span>
            <MdArrowForward className="text-brand-ink/40" />
            <span className="rounded-full bg-brand-deep/10 text-brand-deep px-2.5 py-0.5 text-xs font-bold">{changeText(c.nuevo)}</span>
          </>
        )}
        <span className="inline-flex items-center gap-1 text-brand-ink/50 text-[11px]">
          <MdPerson /> {changeText(c.persona) || '—'}
        </span>
      </div>

      {c.campo === 'estado' && changeText(c.nota) && (
        <p className="mt-2 text-sm text-brand-ink/70 rounded-lg bg-brand-mist/60 border-l-2 border-brand-cyan px-2.5 py-1.5">
          {changeText(c.nota)}
        </p>
      )}
      {c.campo === 'estado' && changeText(c.referencia) && (
        <p className="mt-2 text-sm text-brand-ink/70 rounded-lg bg-brand-mist/60 border-l-2 border-brand-cyan px-2.5 py-1.5">
          Factura/Remisión: {changeText(c.referencia)}
        </p>
      )}
      {c.campo === 'estado' && changeText(c.adjunto) && (
        <p className="mt-2 text-sm text-brand-ink/70 rounded-lg bg-brand-mist/60 border-l-2 border-brand-cyan px-2.5 py-1.5">
          Adjunto: {changeText(c.adjunto)}
        </p>
      )}
    </>
  )
}

export default function NotificationsPanel({ solicitudes, glow = false, solicitudId, paginado = false }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('estado')
  const [vistas, setVistas] = useState(() => loadVistas())
  const [page, setPage] = useState(0)
  const [detalleAbierto, setDetalleAbierto] = useState(true)

  useEffect(() => {
    setPage(0)
    setDetalleAbierto(true)
  }, [tab, solicitudId])

  const cambios = solicitudes
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

  const filtradas = solicitudId ? cambios.filter((c) => c.id === solicitudId) : cambios

  const deEstado = filtradas.filter((c) => c.campo === 'estado')
  const asignaciones = filtradas.filter((c) => c.campo !== 'estado')

  const total = filtradas.length
  const noVistas = filtradas.filter((c) => !vistas[c.key]).length
  const noVistasEstado = deEstado.filter((c) => !vistas[c.key]).length
  const noVistasAsig = asignaciones.filter((c) => !vistas[c.key]).length

  const listado = tab === 'estado' ? deEstado : asignaciones
  const pageCount = listado.length
  const index = paginado ? Math.min(page, Math.max(pageCount - 1, 0)) : 0
  const current = paginado ? listado[index] : null

  const handleToggle = () => {
    setOpen(!open)
  }

  const marcarVista = (key) => {
    if (vistas[key]) return
    const ahora = new Date()
    const stamp = `${ahora.toLocaleDateString('es-CO')} ${ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    const actuales = { ...loadVistas(), [key]: stamp }
    persistVistas(actuales)
    setVistas(actuales)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notificaciones"
        className="relative grid place-items-center size-11 rounded-full bg-brand-navy text-white hover:bg-brand-deep transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/70"
      >
        {glow && (
          <span aria-hidden="true" className="absolute -inset-1.5 rounded-full ring-2 ring-white/80 animate-pulse" />
        )}
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
              {solicitudId && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">{solicitudId}</span>
              )}
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setOpen(false)}
                className="grid place-items-center size-7 rounded-full bg-white/10 hover:bg-white/20 transition"
              >
                <MdClose className="text-sm" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-stretch gap-2 p-2 border-b border-brand-ink/10 shrink-0">
              <button
                type="button"
                onClick={() => setTab('estado')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-all ${
                  tab === 'estado' ? 'bg-brand-cyan/20 text-brand-deep ring-1 ring-brand-cyan/40' : 'bg-brand-mist/40 text-brand-ink/60 hover:bg-brand-cyan/10'
                }`}
              >
                <MdCheckCircle className="text-base" />
                Cambio de estado
                {noVistasEstado > 0 && <span className="min-w-5 h-5 px-1 grid place-items-center rounded-full bg-red-500 text-white text-[10px] font-extrabold">{noVistasEstado > 9 ? '9+' : noVistasEstado}</span>}
              </button>
              <button
                type="button"
                onClick={() => setTab('asignado')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-all ${
                  tab === 'asignado' ? 'bg-brand-cyan/20 text-brand-deep ring-1 ring-brand-cyan/40' : 'bg-brand-mist/40 text-brand-ink/60 hover:bg-brand-cyan/10'
                }`}
              >
                <MdAssignmentInd className="text-base" />
                Asignación
                {noVistasAsig > 0 && <span className="min-w-5 h-5 px-1 grid place-items-center rounded-full bg-red-500 text-white text-[10px] font-extrabold">{noVistasAsig > 9 ? '9+' : noVistasAsig}</span>}
              </button>
            </div>

            <div className="flex flex-col overflow-y-auto p-2">
              {listado.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <MdHistory className="text-3xl text-brand-ink/20 mb-2" />
                  <p className="text-brand-ink/50 text-sm">Sin notificaciones de {tab === 'estado' ? 'cambios de estado' : 'asignaciones'}</p>
                </div>
              ) : paginado ? (
                <>
                  <div className="flex items-center justify-between gap-2 px-2 py-2 border-b border-brand-ink/10 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => setPage(index - 1)}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-navy text-white px-3 py-1.5 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-brand-deep transition"
                    >
                      <MdChevronLeft className="text-base" />
                      Atrás
                    </button>
                    <span className="text-xs font-extrabold text-brand-deep">{index + 1} de {pageCount}</span>
                    <button
                      type="button"
                      disabled={index >= pageCount - 1}
                      onClick={() => setPage(index + 1)}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-navy text-white px-3 py-1.5 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-brand-deep transition"
                    >
                      Siguiente
                      <MdChevronRight className="text-base" />
                    </button>
                  </div>

                  <div className="rounded-xl border border-brand-ink/10 mt-2 shadow-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setDetalleAbierto(!detalleAbierto)
                        marcarVista(current.key)
                      }}
                      className="w-full text-left p-3"
                      aria-expanded={detalleAbierto}
                    >
                      <div className="flex items-center justify-between gap-2 w-full min-w-0">
                        <ItemHeader c={current} i={index} total={pageCount} vistas={vistas} />
                        <MdExpandMore className={`shrink-0 text-2xl text-brand-ink/50 transition-transform ${detalleAbierto ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    {detalleAbierto && (
                      <div className="px-3 pb-3 animate-fadeIn">
                        <ItemBody c={current} />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                listado.map((c, i) => (
                  <button
                    key={c.key || i}
                    type="button"
                    onClick={() => marcarVista(c.key)}
                    className={`w-full text-left rounded-xl border p-3 mb-2 shadow-sm animate-fadeIn transition-all ${
                      vistas[c.key]
                        ? 'border-brand-ink/10 bg-brand-mist/30 hover:bg-brand-cyan/10'
                        : 'border-brand-cyan/30 bg-white hover:bg-brand-cyan/10'
                    }`}
                  >
                    <ItemHeader c={c} i={i} total={listado.length} vistas={vistas} />
                    <ItemBody c={c} />
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}