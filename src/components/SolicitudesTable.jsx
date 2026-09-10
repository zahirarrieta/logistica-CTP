import { useState } from 'react'
import {
  MdTag,
  MdCalendarToday,
  MdAccessTime,
  MdPerson,
  MdEmail,
  MdAssignmentAdd,
  MdBusiness,
  MdPlace,
  MdAttachFile,
  MdNotes,
  MdCheckCircle,
  MdAssignmentInd,
  MdNavigateBefore,
  MdNavigateNext,
  MdExpandMore,
  MdInbox,
  MdHistory,
  MdMessage,
  MdWarehouse,
  MdPersonAdd,
  MdSwapHoriz,
} from 'react-icons/md'
import { getBadgeColor, getDotColor, getEstadoBg } from '../pages/Home/Components/estadoColors.js'
import { nombreDeAsignado } from '../pages/Home/Components/solicitudesStore.js'
import ObservacionesModal from './ObservacionesModal.jsx'
import DetalleModal from './DetalleModal.jsx'

const ITEMS_PER_PAGE = 10

function Row({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-brand-ink/5 last:border-0">
      <span className="text-brand-cyan mt-0.5 shrink-0">{icon}</span>
      <span className="text-brand-ink/50 w-24 shrink-0">{label}</span>
      <span className="text-brand-ink font-medium capitalize">{value}</span>
    </div>
  )
}

export function EstadoBadge({ estado }) {
  const current = estado || 'Abierto'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${getBadgeColor(current)}`}>
      <span className={`size-2 rounded-full ${getDotColor(current)}`} />
      {current}
    </span>
  )
}

export function AsignadoBadge({ asignado }) {
  const nombre = nombreDeAsignado(asignado)
  if (!nombre) return <span className="text-brand-ink/40 text-sm">—</span>
  const ini = nombre
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-deep/10 text-brand-deep px-2.5 py-1 text-xs font-bold whitespace-nowrap">
      <span className="grid place-items-center size-4 rounded-full bg-brand-deep text-white text-[9px]">{ini}</span>
      {nombre}
    </span>
  )
}

function HistorialButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ver historial"
      title="Historial"
      className="grid place-items-center size-9 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors"
    >
      <MdHistory className="text-lg" />
    </button>
  )
}

function SolicitudCard({ s, expanded, onToggle, index, number, actions, onEstadoClick, onClickObs, colorRow, onAsignarClick, onCambiarEstadoClick }) {
  const isEven = index % 2 === 0
  const action = actions ? actions(s) : null
  const cardBg = colorRow ? getEstadoBg(s.estado) : (isEven ? 'bg-white' : 'bg-brand-cyan/10')
  const hasCardAcciones = Boolean(onAsignarClick || onCambiarEstadoClick || onEstadoClick)

  return (
    <div className={`rounded-2xl border border-brand-ink/15 shadow-sm overflow-hidden ${cardBg}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-4 text-left transition-colors hover:bg-brand-deep/20 ${expanded ? 'bg-brand-deep/20' : ''}`}
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span className="inline-flex items-center gap-2 min-w-0">
            {number != null && (
              <span className="shrink-0 grid place-items-center size-6 rounded-full bg-brand-navy text-white text-[11px] font-extrabold">
                {number}
              </span>
            )}
            <span className="font-bold text-brand-deep truncate">{s.id}</span>
          </span>
          <span className="text-xs text-brand-ink/60 capitalize">{s.nombreCompleto} · {s.tipoSolicitud}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <EstadoBadge estado={s.estado} />
          <MdExpandMore className={`text-xl text-brand-ink/50 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-2 text-sm border-t border-brand-ink/10 animate-fadeIn">
          <Row icon={<MdTag />} label="ID" value={s.id} />
          <Row icon={<MdCalendarToday />} label="Fecha" value={s.fechaSubida || '—'} />
          <Row icon={<MdAccessTime />} label="Hora" value={s.horaSubida || '—'} />
          <Row icon={<MdPerson />} label="Nombre" value={s.nombreCompleto} />
          <Row icon={<MdEmail />} label="Correo" value={s.correo} />
          <Row icon={<MdAssignmentAdd />} label="Tipo" value={s.tipoSolicitud} />
          <Row icon={<MdBusiness />} label="Cliente" value={s.cliente} />
          <Row icon={<MdWarehouse />} label="Bodega" value={s.bodega} />
          <Row icon={<MdTag />} label="NIT" value={s.nit} />
          <Row icon={<MdPlace />} label="Zona" value={s.zona} />
          <Row icon={<MdAttachFile />} label="Adjuntos" value={s.adjuntos?.length > 0 ? `${s.adjuntos.length} archivo(s)` : '—'} />
          <div className="flex items-center justify-between gap-2 py-1.5 border-b border-brand-ink/5 last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-brand-cyan mt-0.5 shrink-0"><MdNotes /></span>
              <span className="text-brand-ink/50 shrink-0">Observaciones</span>
            </div>
            <button
              type="button"
              onClick={() => onClickObs(s)}
              aria-label="Ver observaciones"
              title="Ver observaciones"
              className="grid place-items-center size-8 rounded-full bg-brand-ink/10 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors"
            >
              <MdMessage className="text-lg" />
            </button>
          </div>
          <div className="flex items-start gap-2 py-1.5 border-b border-brand-ink/5 last:border-0">
            <span className="text-brand-cyan mt-0.5 shrink-0"><MdAssignmentInd /></span>
            <span className="text-brand-ink/50 w-24 shrink-0">Asignado a</span>
            <AsignadoBadge asignado={s.asignadoA} />
          </div>
          <div className="flex items-start gap-2 py-1.5 border-b border-brand-ink/5 last:border-0">
            <span className="text-brand-cyan mt-0.5 shrink-0"><MdCheckCircle /></span>
            <span className="text-brand-ink/50 w-24 shrink-0">Estado</span>
            <span className="flex flex-wrap items-center gap-2 min-w-0">
              <EstadoBadge estado={s.estado} />
            </span>
          </div>
          {hasCardAcciones && (
            <div className="grid grid-cols-3 gap-2 pt-2">
              {onAsignarClick && (
                <button
                  type="button"
                  onClick={() => onAsignarClick(s)}
                  title="Asignar usuario"
                  aria-label="Asignar usuario"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors px-2 py-2 text-xs font-bold"
                >
                  <MdPersonAdd className="text-lg" />
                  Asignar
                </button>
              )}
              {onCambiarEstadoClick && (
                <button
                  type="button"
                  onClick={() => onCambiarEstadoClick(s)}
                  title="Cambiar estado"
                  aria-label="Cambiar estado"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-navy/10 text-brand-deep hover:bg-brand-navy hover:text-white transition-colors px-2 py-2 text-xs font-bold"
                >
                  <MdSwapHoriz className="text-lg" />
                  Estado
                </button>
              )}
              {onEstadoClick && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEstadoClick(s)
                  }}
                  title="Historial"
                  aria-label="Ver historial"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors px-2 py-2 text-xs font-bold"
                >
                  <MdHistory className="text-lg" />
                  Historial
                </button>
              )}
            </div>
          )}
          {action}
        </div>
      )}
    </div>
  )
}

export default function SolicitudesTable({ items, onRowClick, onEstadoClick, onAsignarClick, onCambiarEstadoClick, cardActions, empty, colorRowsPorEstado }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const [obsSolicitud, setObsSolicitud] = useState(null)
  const [detalleSolicitud, setDetalleSolicitud] = useState(null)
  const [correoTooltip, setCorreoTooltip] = useState(null)

  const handleCorreoEnter = (e, correo) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setCorreoTooltip({ text: correo, x: rect.left + rect.width / 2, y: rect.bottom + 6 })
  }
  const handleCorreoLeave = () => setCorreoTooltip(null)

  const openObs = (s) => setObsSolicitud(s)
  const openDetalle = (s) => setDetalleSolicitud(s)
  const hasAcciones = Boolean(onEstadoClick || onAsignarClick || onCambiarEstadoClick)

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE) || 1
  const page = Math.min(currentPage, totalPages)
  const startIndex = (page - 1) * ITEMS_PER_PAGE
  const currentItems = items.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-6 text-center bg-white">
        <span className="text-4xl sm:text-5xl text-brand-ink/20 mb-3">{empty?.icon || <MdInbox />}</span>
        <p className="text-brand-ink/70 font-semibold">{empty?.title || 'No hay solicitudes'}</p>
        {empty?.text && <p className="text-brand-ink/50 text-sm mt-1">{empty.text}</p>}
      </div>
    )
  }

  return (
    <>
      {/* Cards — visible solo en móvil */}
      <div className="md:hidden space-y-3">
        {currentItems.map((s, i) => (
          <SolicitudCard
            key={s.id}
            s={s}
            index={i}
            number={startIndex + i + 1}
            expanded={expandedId === s.id}
            onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
            actions={cardActions}
            onEstadoClick={onEstadoClick}
            onAsignarClick={onAsignarClick}
            onCambiarEstadoClick={onCambiarEstadoClick}
            onClickObs={openObs}
            colorRow={colorRowsPorEstado}
          />
        ))}
      </div>

      {/* Tabla — visible solo en desktop */}
      <div className="hidden md:block overflow-x-auto">
        <div className="overflow-hidden rounded-2xl border border-brand-ink/15 shadow-sm">
          <table className="w-full text-left text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-brand-navy text-white text-left uppercase tracking-wider">
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15 w-14 text-center">N°</th>
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15">
                  <span className="inline-flex items-center gap-1.5"><MdTag className="text-base" /> ID</span>
                </th>
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15">
                  <span className="inline-flex items-center gap-1.5"><MdCalendarToday className="text-base" /> Fecha</span>
                </th>
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15">
                  <span className="inline-flex items-center gap-1.5"><MdPerson className="text-base" /> Nombre</span>
                </th>
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15 text-center w-16">
                  <span className="inline-flex items-center gap-1.5"><MdEmail className="text-base" /> Correo</span>
                </th>
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15">
                  <span className="inline-flex items-center gap-1.5"><MdAssignmentAdd className="text-base" /> Tipo</span>
                </th>
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15">
                  <span className="inline-flex items-center gap-1.5"><MdBusiness className="text-base" /> Cliente</span>
                </th>
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15">
                  <span className="inline-flex items-center gap-1.5"><MdPlace className="text-base" /> Zona</span>
                </th>
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15">
                  <span className="inline-flex items-center gap-1.5"><MdAttachFile className="text-base" /> Adjuntos</span>
                </th>
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15 text-center w-16">
                  <span className="inline-flex items-center gap-1.5"><MdNotes className="text-base" /> Obs.</span>
                </th>
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15">
                  <span className="inline-flex items-center gap-1.5"><MdAssignmentInd className="text-base" /> Asignado a</span>
                </th>
                <th className="px-3 py-4 text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5"><MdCheckCircle className="text-base" /> Estado</span>
                </th>
                {hasAcciones && (
                  <th className="px-3 py-4 w-32 sticky right-0 z-10 bg-brand-navy">
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {currentItems.map((s, i) => (
                <tr
                  key={s.id}
                  onClick={onRowClick ? () => onRowClick(s) : undefined}
                  className={`group ${onRowClick ? 'cursor-pointer active:animate-rowPop active:bg-brand-deep/30' : ''} transition-colors hover:bg-brand-deep/20 ${colorRowsPorEstado ? getEstadoBg(s.estado) : (i % 2 === 0 ? 'bg-white' : 'bg-brand-cyan/10')}`}
                >
                  <td className="px-3 py-3 text-center border-b border-l border-brand-ink/10">
                    <span className={`inline-flex items-center justify-center size-7 rounded-full text-xs font-extrabold ${i % 2 === 0 ? 'bg-brand-navy text-white' : 'bg-brand-deep text-white'}`}>
                      {startIndex + i + 1}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-bold text-brand-deep whitespace-nowrap border-b border-l border-brand-ink/10">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openDetalle(s) }}
                      title="Ver detalle completo"
                      aria-label="Ver detalle de la solicitud"
                      className="inline-flex items-center gap-1 rounded-md text-brand-deep font-bold underline-offset-4 hover:underline decoration-brand-cyan decoration-2 hover:text-brand-deep/90 transition-colors"
                    >
                      {s.id}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">
                    <span className="block">{s.fechaSubida || '—'}</span>
                    {s.horaSubida && <span className="block text-xs text-brand-ink/50">{s.horaSubida}</span>}
                  </td>
                  <td className="px-2 py-3 font-semibold text-brand-ink min-w-[150px] border-b border-l border-brand-ink/10">{s.nombreCompleto}</td>
                  <td className="px-2 py-3 border-b border-l border-brand-ink/10 text-center">
                    <span
                      className="inline-flex items-center justify-center"
                      onMouseEnter={(e) => handleCorreoEnter(e, s.correo)}
                      onMouseLeave={handleCorreoLeave}
                    >
                      <span className="grid place-items-center size-8 rounded-full bg-brand-cyan/10 text-brand-deep cursor-help">
                        <MdEmail className="text-lg" />
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-3 capitalize text-brand-ink/80 max-w-[110px] truncate whitespace-nowrap border-b border-l border-brand-ink/10">{s.tipoSolicitud}</td>
                  <td className="px-2 py-3 text-brand-ink/80 max-w-[140px] truncate whitespace-nowrap border-b border-l border-brand-ink/10">{s.cliente}</td>
                  <td className="px-2 py-3 capitalize text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{s.zona}</td>
                  <td className="px-2 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">
                    {s.adjuntos && s.adjuntos.length > 0 ? `${s.adjuntos.length} archivo(s)` : '—'}
                  </td>
                  <td className="px-2 py-3 border-b border-l border-brand-ink/10 text-center">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setObsSolicitud(s) }}
                      title="Ver observaciones"
                      aria-label="Ver observaciones"
                      className="grid place-items-center size-8 rounded-full bg-brand-ink/10 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors mx-auto"
                    >
                      <MdMessage className="text-lg" />
                    </button>
                  </td>
                  <td className="px-2 py-3 border-b border-l border-brand-ink/10">
                    <AsignadoBadge asignado={s.asignadoA} />
                  </td>
                  <td className="px-3 py-3 border-b border-l border-brand-ink/10">
                    <EstadoBadge estado={s.estado} />
                  </td>
                  {hasAcciones && (
                    <td className={`px-3 py-3 border-b border-l border-brand-ink/10 sticky right-0 z-10 transition-colors group-hover:bg-brand-deep/20 ${colorRowsPorEstado ? getEstadoBg(s.estado) : (i % 2 === 0 ? 'bg-white' : 'bg-brand-cyan/10')}`}>
                      <div className="flex items-center justify-center gap-1.5">
                        {onAsignarClick && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onAsignarClick(s) }}
                            title="Asignar usuario"
                            aria-label="Asignar usuario"
                            className="grid place-items-center size-9 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors"
                          >
                            <MdPersonAdd className="text-xl" />
                          </button>
                        )}
                        {onCambiarEstadoClick && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCambiarEstadoClick(s) }}
                            title="Cambiar estado"
                            aria-label="Cambiar estado"
                            className="grid place-items-center size-9 rounded-full bg-brand-navy/10 text-brand-deep hover:bg-brand-navy hover:text-white transition-colors"
                          >
                            <MdSwapHoriz className="text-xl" />
                          </button>
                        )}
                        {onEstadoClick && (
                          <HistorialButton
                            onClick={(e) => {
                              e.stopPropagation()
                              onEstadoClick(s)
                            }}
                          />
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-6">
        <button
          type="button"
          onClick={() => setCurrentPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="inline-flex items-center gap-1 rounded-full bg-brand-navy text-white font-bold px-3 sm:px-5 py-2 sm:py-2.5 text-sm hover:bg-brand-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <MdNavigateBefore className="text-lg" />
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <div className="flex items-center gap-1 sm:gap-1.5">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setCurrentPage(p)}
              className={`size-8 sm:size-9 rounded-full font-bold text-sm transition-all ${
                page === p
                  ? 'bg-brand-cyan text-brand-ink shadow-cyanGlow'
                  : 'bg-white text-brand-ink border border-brand-ink/15 hover:bg-brand-deep/10'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="inline-flex items-center gap-1 rounded-full bg-brand-navy text-white font-bold px-3 sm:px-5 py-2 sm:py-2.5 text-sm hover:bg-brand-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <MdNavigateNext className="text-lg" />
        </button>
      </div>

      <ObservacionesModal
        solicitud={obsSolicitud}
        open={obsSolicitud !== null}
        onClose={() => setObsSolicitud(null)}
      />

      <DetalleModal
        solicitud={detalleSolicitud}
        open={detalleSolicitud !== null}
        onClose={() => setDetalleSolicitud(null)}
      />

      {correoTooltip && (
        <div
          className="pointer-events-none fixed z-[1200] -translate-x-1/2 whitespace-nowrap rounded-lg bg-brand-navy text-white text-xs px-3 py-1.5 shadow-xl"
          style={{ left: correoTooltip.x, top: correoTooltip.y }}
        >
          {correoTooltip.text}
        </div>
      )}
    </>
  )
}