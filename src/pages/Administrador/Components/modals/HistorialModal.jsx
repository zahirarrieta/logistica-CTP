import { useEffect, useState } from 'react'
import { MdClose, MdHistory, MdTag, MdBusiness, MdPlace, MdPerson, MdAccessTime, MdArrowForward, MdCheckCircle, MdAssignmentInd } from 'react-icons/md'
import { getBadgeColor, getDotColor } from '../../../Home/Components/estadoColors.js'

export default function HistorialModal({ solicitud, open, onClose }) {
  const [tab, setTab] = useState('estado')

  useEffect(() => {
    if (open) setTab('estado')
  }, [open])

  if (!open || !solicitud) return null

  const historial = Array.isArray(solicitud.historial) ? solicitud.historial : []
  const deEstado = historial.filter((h) => h.campo === 'estado')
  const asignaciones = historial.filter((h) => h.campo !== 'estado')
  const listado = tab === 'estado' ? deEstado : asignaciones

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-lg rounded-2xl shadow-2xl animate-scaleIn max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Historial de cambios"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40">
              <MdHistory className="text-brand-cyan text-lg" />
            </span>
            HISTORIAL DE CAMBIOS
          </h3>
          <button
            aria-label="Cerrar"
            onClick={onClose}
            className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        <div className="px-3 sm:px-4 py-2 border-b border-brand-ink/10 shrink-0">
            <div className="flex items-stretch gap-2 p-1 bg-brand-mist/60 rounded-2xl">
              <button
                type="button"
                onClick={() => setTab('estado')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-all ${
                  tab === 'estado' ? 'bg-white text-brand-deep shadow-sm ring-1 ring-brand-cyan/40' : 'text-brand-ink/60 hover:text-brand-deep'
                }`}
              >
                <MdCheckCircle className="text-base" />
                Cambio de estado
                {deEstado.length > 0 && <span className="rounded-full bg-brand-cyan/15 text-brand-deep px-1.5 py-0.5 text-[10px] font-extrabold">{deEstado.length}</span>}
              </button>
              <button
                type="button"
                onClick={() => setTab('asignado')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-all ${
                  tab === 'asignado' ? 'bg-white text-brand-deep shadow-sm ring-1 ring-brand-cyan/40' : 'text-brand-ink/60 hover:text-brand-deep'
                }`}
              >
                <MdAssignmentInd className="text-base" />
                Asignación
                {asignaciones.length > 0 && <span className="rounded-full bg-brand-cyan/15 text-brand-deep px-1.5 py-0.5 text-[10px] font-extrabold">{asignaciones.length}</span>}
              </button>
            </div>
          </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Resumen de la solicitud */}
          <div className="rounded-xl bg-brand-ink/5 border border-brand-ink/10 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1 font-bold text-brand-deep"><MdTag className="text-brand-cyan" /> {solicitud.id}</span>
            <span className="inline-flex items-center gap-1 text-brand-ink/70"><MdBusiness className="text-brand-cyan" /> {solicitud.cliente || '—'}</span>
            <span className="inline-flex items-center gap-1 capitalize text-brand-ink/70"><MdPlace className="text-brand-cyan" /> {solicitud.zona || '—'}</span>
          </div>

          {/* Lista de cambios (estado o asignación según tab) */}
          {listado.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <MdHistory className="text-4xl text-brand-ink/20 mb-2" />
              <p className="text-brand-ink/50 text-sm">Sin {tab === 'estado' ? 'cambios de estado' : 'asignaciones'} registrados todavía</p>
            </div>
          ) : (
            <ol className="space-y-3">
              {listado.map((h, i) => {
                const esEstado = h.campo === 'estado'
                const numero = listado.length - i
                return (
                  <li key={i} className="flex gap-3 rounded-xl border border-brand-ink/10 bg-white shadow-sm p-3 animate-fadeIn">
                    <span
                      className="shrink-0 grid place-items-center size-8 rounded-full font-extrabold text-sm text-brand-ink bg-brand-cyan shadow-cyanGlow"
                      aria-label={`Cambio ${numero}`}
                    >
                      {numero}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 font-bold text-brand-deep">
                          {esEstado ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-cyan/15 text-brand-deep px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                              <MdCheckCircle /> Cambio de estado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-deep/10 text-brand-deep px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                              <MdAssignmentInd /> Asignación de usuario
                            </span>
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1 text-brand-ink/60"><MdAccessTime /> {h.fecha} · {h.hora}</span>
                        <span className="inline-flex items-center gap-1 text-brand-ink/60"><MdPerson /> {h.persona || '—'}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {esEstado ? (
                          <>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${getBadgeColor(h.anterior)}`}>
                              <span className={`size-1.5 rounded-full ${getDotColor(h.anterior)}`} />
                              {h.anterior}
                            </span>
                            <MdArrowForward className="text-brand-ink/40" />
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${getBadgeColor(h.nuevo)}`}>
                              <span className={`size-1.5 rounded-full ${getDotColor(h.nuevo)}`} />
                              {h.nuevo}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="rounded-full bg-brand-ink/10 text-brand-ink/60 px-2.5 py-0.5 text-xs font-bold">{h.anterior}</span>
                            <MdArrowForward className="text-brand-ink/40" />
                            <span className="rounded-full bg-brand-deep/10 text-brand-deep px-2.5 py-0.5 text-xs font-bold">{h.nuevo}</span>
                          </>
                        )}
                      </div>
                      {h.nota && (
                        <p className="mt-2 text-sm text-brand-ink/70 rounded-lg bg-brand-mist/60 border-l-2 border-brand-cyan px-2.5 py-1.5">
                          {h.nota}
                        </p>
                      )}
                      {h.referencia && (
                        <p className="mt-2 text-sm text-brand-ink/70 rounded-lg bg-brand-mist/60 border-l-2 border-brand-cyan px-2.5 py-1.5">
                          Factura/Remisión: {h.referencia}
                        </p>
                      )}
                      {h.adjunto && (
                        <p className="mt-2 text-sm text-brand-ink/70 rounded-lg bg-brand-mist/60 border-l-2 border-brand-cyan px-2.5 py-1.5">
                          Adjunto: {h.adjunto}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}