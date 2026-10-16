import { Fragment, useState } from 'react'
import {
  MdTag, MdCalendarToday, MdAccessTime, MdPerson, MdEmail, MdCategory,
  MdPlace, MdAttachFile, MdNotes, MdStorefront, MdWarehouse, MdSupportAgent, MdMap,
  MdPhone, MdEvent, MdNavigateBefore, MdNavigateNext, MdExpandMore, MdInbox,
  MdListAlt, MdOpenInFull, MdArrowForward, MdPersonAdd, MdSwapHoriz, MdHistory,
  MdAssignmentInd, MdNotificationsNone,
} from 'react-icons/md'
import { paginasVisibles } from '../../../utils/paginacion.js'
import { getRecoleccionBadge, getRecoleccionDot, getRecoleccionBg } from '../../../utils/estadoRecoleccion.js'
import AdjuntosModal from '../../../components/AdjuntosModal.jsx'
import NotificationsPanel from '../../../components/NotificationsPanel.jsx'
import TablaQueRecogemos from '../../../components/TablaQueRecogemos.jsx'
import { AsignadoBadge } from '../../../components/SolicitudesTable.jsx'
import { EstadoBadge } from './modals/RecoleccionDetalleModal.jsx'
import RecoleccionSeguimientoModal from './modals/RecoleccionSeguimientoModal.jsx'

const ITEMS_PER_PAGE = 10

const adjuntosDe = (r) => (Array.isArray(r?.adjuntos) ? r.adjuntos : [])

const tieneAsignado = (r) =>
  Boolean(String(r?.asignado_a || r?.asignado_correo || '').trim())

// La campana reutiliza el panel de solicitudes, que trabaja con forma de
// solicitud (id/cliente/zona/historial); la fila de recolección trae los nombres
// de columna del backend.
const paraNotificaciones = (r) => ({
  id: r.codigo,
  cliente: r.recoge_cliente,
  zona: r.zona,
  historial: Array.isArray(r.historial) ? r.historial : [],
})

function Campana({ r }) {
  return (
    <span className="inline-flex justify-center" onClick={(e) => e.stopPropagation()}>
      <NotificationsPanel
        solicitudes={[paraNotificaciones(r)]}
        solicitudId={r.codigo}
        titulo="Notificaciones de cambio"
        compacto
        fixed
        badgeDe={getRecoleccionBadge}
        dotDe={getRecoleccionDot}
      />
    </span>
  )
}

// Estados que cierran la recolección: ya no admiten asignación ni cambio de
// estado (solo queda el historial), igual que «Cancelado» en solicitudes.
const ESTADOS_TERMINALES = ['Cancelado', 'Fallido']
const esTerminal = (r) => ESTADOS_TERMINALES.includes(r?.estado)

// Dato de una tarjeta del panel «Recoge / Entrega».
function Dato({ label, valor, icon, full = false }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-[0.65rem] font-bold uppercase tracking-wider text-brand-deep/70 inline-flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-sm text-brand-ink whitespace-pre-wrap break-words">
        {valor || <span className="text-brand-ink/40">—</span>}
      </p>
    </div>
  )
}

// Título simple de una tarjeta del panel (sin encabezado de color).
function CardTitulo({ icon, titulo }) {
  return (
    <p className="text-xs font-extrabold uppercase tracking-wider text-brand-deep inline-flex items-center gap-2">
      <span className="text-brand-cyan">{icon}</span>
      {titulo}
    </p>
  )
}

// Panel que se despliega desde la columna «Recoge / Entrega»: dos tarjetas
// (lo que se recoge y lo que se entrega) y, debajo, la tabla de «Qué recogemos».
function PanelRecogeEntrega({ r }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="rounded-2xl border border-brand-deep/15 bg-white p-4 space-y-3 shadow-sm">
          <CardTitulo icon={<MdStorefront />} titulo="Recogida" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Dato label="¿Dónde recogemos?" valor={r.recoge_cliente} icon={<MdStorefront className="text-sm" />} />
            <Dato label="Bodega" valor={r.recoge_bodega} icon={<MdWarehouse className="text-sm" />} />
            <Dato label="Fecha" valor={r.fecha_recoleccion} icon={<MdEvent className="text-sm" />} />
            <Dato label="Hora" valor={r.hora_recoleccion} icon={<MdAccessTime className="text-sm" />} />
            <Dato label="Persona de contacto" valor={r.persona_contacto} icon={<MdSupportAgent className="text-sm" />} />
            <Dato label="Teléfono de contacto" valor={r.telefono_contacto} icon={<MdPhone className="text-sm" />} />
          </div>
        </div>

        <div className="rounded-2xl border border-brand-deep/15 bg-white p-4 space-y-3 shadow-sm">
          <CardTitulo icon={<MdWarehouse />} titulo="Entrega" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Dato label="¿Dónde entregamos?" valor={r.entrega_cliente} icon={<MdWarehouse className="text-sm" />} full />
            <Dato label="Bodega" valor={r.entrega_bodega} icon={<MdWarehouse className="text-sm" />} full />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-deep/15 bg-white p-4 space-y-3 shadow-sm">
        <CardTitulo icon={<MdNotes />} titulo="Qué recogemos" />
        <TablaQueRecogemos texto={r.que_recogemos} compacto />
      </div>
    </div>
  )
}

function Row({ icon, label, value, hint }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-brand-ink/5 last:border-0">
      <span className="text-brand-cyan mt-0.5 shrink-0">{icon}</span>
      <span className="text-brand-ink/50 w-28 shrink-0">{label}</span>
      <span className="min-w-0">
        <span className="block text-brand-ink font-medium capitalize break-words">{value || '—'}</span>
        {hint && <span className="block text-xs text-brand-ink/60 break-words">{hint}</span>}
      </span>
    </div>
  )
}

function RecoleccionCard({ r, index, number, expanded, onToggle, onVerSeguimiento, onVerDetalle, onVerAdjuntos, onAsignarClick, onCambiarEstadoClick, onHistorialClick, mostrarNotificaciones, colorRowsPorEstado }) {
  const isEven = index % 2 === 0
  const cardBg = colorRowsPorEstado
    ? getRecoleccionBg(r.estado)
    : isEven
      ? 'bg-white'
      : 'bg-brand-cyan/10'
  const adjuntos = adjuntosDe(r)
  const mostrarAcciones = Boolean(onAsignarClick || onCambiarEstadoClick || onHistorialClick)

  return (
    <div className={`rounded-2xl border border-brand-ink/15 shadow-sm overflow-hidden ${cardBg}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-4 text-left transition-colors hover:bg-brand-deep/20 ${expanded ? 'bg-brand-deep/20' : ''}`}
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span className="inline-flex items-center gap-2 min-w-0">
            <span className="shrink-0 grid place-items-center size-6 rounded-full bg-brand-navy text-white text-[11px] font-extrabold">
              {number}
            </span>
            <span className="font-bold text-brand-deep truncate">{(r.codigo || '').toUpperCase()}</span>
          </span>
          <span className="text-xs text-brand-ink/60 capitalize truncate">
            {r.nombre_completo || '—'} · {r.tipo_servicio || '—'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <EstadoBadge estado={r.estado} />
          <MdExpandMore className={`text-xl text-brand-ink/50 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-2 text-sm border-t border-brand-ink/10 animate-fadeIn">
          <Row icon={<MdTag />} label="ID" value={(r.codigo || '').toUpperCase()} />
          <Row icon={<MdCalendarToday />} label="Fecha" value={r.fecha_subida} />
          <Row icon={<MdAccessTime />} label="Hora" value={r.hora_subida} />
          <Row icon={<MdPerson />} label="Nombre" value={r.nombre_completo} />
          <Row icon={<MdEmail />} label="Correo" value={r.correo} />
          <Row icon={<MdCategory />} label="Tipo de servicio" value={r.tipo_servicio} />
          <Row icon={<MdPlace />} label="Zona" value={r.zona} />
          <Row
            icon={<MdAssignmentInd />}
            label="Asignado a"
            value={r.asignado_a}
            hint={r.conductor ? `Conductor: ${r.conductor}` : ''}
          />

          {mostrarNotificaciones && (
            <div className="flex items-center gap-2 py-1.5 border-b border-brand-ink/5 last:border-0">
              <span className="text-brand-cyan shrink-0"><MdNotificationsNone /></span>
              <span className="text-brand-ink/50 w-28 shrink-0">Notificaciones</span>
              <Campana r={r} />
            </div>
          )}

          <div className="pt-3">
            <PanelRecogeEntrega r={r} />
          </div>

          <Row icon={<MdNotes />} label="Instrucciones" value={r.observaciones} />

          <div className="flex items-center justify-between gap-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-brand-cyan mt-0.5 shrink-0"><MdAttachFile /></span>
              <span className="text-brand-ink/50 shrink-0">Adjuntos</span>
            </div>
            {adjuntos.length > 0 ? (
              <button
                type="button"
                onClick={() => onVerAdjuntos(r)}
                aria-label="Ver adjuntos"
                title="Ver adjuntos"
                className="inline-flex items-center gap-1 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors px-3 py-1.5 text-xs font-bold"
              >
                <MdAttachFile className="text-sm" />
                {adjuntos.length} archivo(s)
              </button>
            ) : (
              <span className="text-brand-ink/40 text-sm">—</span>
            )}
          </div>

          <div className={`mt-2 grid gap-2 ${onVerSeguimiento ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {onVerSeguimiento && (
              <button
                type="button"
                onClick={() => onVerSeguimiento(r)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-navy px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-deep transition"
              >
                <MdMap className="text-lg" />
                Seguimiento
              </button>
            )}
            <button
              type="button"
              onClick={() => onVerDetalle(r)}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-cyan px-4 py-2.5 text-sm font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] transition"
            >
              <MdOpenInFull className="text-lg" />
              Detalle
            </button>
          </div>

          {mostrarAcciones && (
            <div className="grid grid-cols-3 gap-2 pt-2">
              {onAsignarClick && !esTerminal(r) && (
                <button
                  type="button"
                  onClick={() => onAsignarClick(r)}
                  title="Asignar usuario"
                  aria-label="Asignar usuario"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors px-2 py-2 text-xs font-bold"
                >
                  <MdPersonAdd className="text-lg" />
                  Asignar
                </button>
              )}
              {onCambiarEstadoClick && !esTerminal(r) && (
                <button
                  type="button"
                  onClick={() => {
                    if (!tieneAsignado(r)) return
                    onCambiarEstadoClick(r)
                  }}
                  disabled={!tieneAsignado(r)}
                  title={tieneAsignado(r) ? 'Cambiar estado' : 'Debes asignar una persona primero'}
                  aria-label="Cambiar estado"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-navy/10 text-brand-deep hover:bg-brand-navy hover:text-white transition-colors px-2 py-2 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-navy/10 disabled:hover:text-brand-deep"
                >
                  <MdSwapHoriz className="text-lg" />
                  Estado
                </button>
              )}
              {onHistorialClick && (
                <button
                  type="button"
                  onClick={() => onHistorialClick(r)}
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
        </div>
      )}
    </div>
  )
}

export default function RecoleccionesTable({ items, onRowClick, onAsignarClick, onCambiarEstadoClick, onHistorialClick, mostrarNotificaciones = false, colorRowsPorEstado = false, seguimientoEnFila = false, onCorregirClick }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const [adjuntosRecoleccion, setAdjuntosRecoleccion] = useState(null)
  const [seguimiento, setSeguimiento] = useState(null)

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE) || 1
  const page = Math.min(currentPage, totalPages)
  const startIndex = (page - 1) * ITEMS_PER_PAGE
  const currentItems = items.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  // La columna de acciones solo se dibuja si hay manejadores y al menos una fila
  // de la página actual ofrece algún botón (así no queda una columna vacía).
  const hayAcciones =
    Boolean(onAsignarClick || onCambiarEstadoClick || onHistorialClick) &&
    currentItems.some(
      (r) => onHistorialClick || (!esTerminal(r) && (onAsignarClick || onCambiarEstadoClick))
    )
  const columnas = 11 + (mostrarNotificaciones ? 1 : 0) + (hayAcciones ? 1 : 0)

  // Ancho mínimo de la tabla. Las clases van literales (nada de plantillas con el
  // número calculado) porque Tailwind solo genera las que ve en el código.
  const minW = hayAcciones
    ? (mostrarNotificaciones ? 'min-w-[1450px]' : 'min-w-[1380px]')
    : (mostrarNotificaciones ? 'min-w-[1350px]' : 'min-w-[1280px]')

  const toggle = (codigo) => setExpandedId((prev) => (prev === codigo ? null : codigo))

  // Clic en la fila: en «Mis recolecciones» abre el seguimiento (como en «Mis
  // solicitudes»); en el resto de módulos la fila no abre nada y el detalle
  // completo solo se abre desde el ID (o el botón «Detalle» en móvil).
  const abrirFila = (r) => {
    if (seguimientoEnFila) setSeguimiento(r)
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-6 text-center bg-white">
        <span className="text-4xl sm:text-5xl text-brand-ink/20 mb-3"><MdInbox /></span>
        <p className="text-brand-ink/70 font-semibold">No hay recolecciones</p>
      </div>
    )
  }

  return (
    <>
      {/* Cards — visible solo en móvil */}
      <div className="md:hidden space-y-3">
        {currentItems.map((r, i) => (
          <RecoleccionCard
            key={r.codigo}
            r={r}
            index={i}
            number={startIndex + i + 1}
            expanded={expandedId === r.codigo}
            onToggle={() => toggle(r.codigo)}
            onVerSeguimiento={seguimientoEnFila ? setSeguimiento : undefined}
            onVerDetalle={onRowClick}
            onVerAdjuntos={setAdjuntosRecoleccion}
            onAsignarClick={onAsignarClick}
            onCambiarEstadoClick={onCambiarEstadoClick}
            onHistorialClick={onHistorialClick}
            mostrarNotificaciones={mostrarNotificaciones}
            colorRowsPorEstado={colorRowsPorEstado}
          />
        ))}
      </div>

      {/* Tabla — visible en tablet y desktop */}
      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-2xl border border-brand-ink/15 shadow-sm">
          <table className={`w-full text-left text-sm border-separate border-spacing-0 ${minW}`}>
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
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15">
                  <span className="inline-flex items-center gap-1.5"><MdCategory className="text-base" /> Tipo de servicio</span>
                </th>
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15">
                  <span className="inline-flex items-center gap-1.5"><MdPlace className="text-base" /> Zona</span>
                </th>
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15 text-center">
                  <span className="inline-flex items-center justify-center gap-1.5"><MdArrowForward className="text-base" /> Recoge / Entrega</span>
                </th>
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15">
                  <span className="inline-flex items-center gap-1.5"><MdNotes className="text-base" /> Instrucciones</span>
                </th>
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15">
                  <span className="inline-flex items-center gap-1.5"><MdAttachFile className="text-base" /> Adjuntos</span>
                </th>
                <th className="px-3 py-4 text-xs font-bold border-r border-white/15 text-center">
                  <span className="inline-flex items-center justify-center gap-1.5"><MdAssignmentInd className="text-base" /> Asignado a</span>
                </th>
                <th className={`px-3 py-4 text-xs font-bold text-center${mostrarNotificaciones ? ' border-r border-white/15' : ''}`}>
                  <span className="inline-flex items-center justify-center gap-1.5"><MdTag className="text-base" /> Estado</span>
                </th>
                {mostrarNotificaciones && (
                  <th className="px-3 py-4 w-16 text-center">
                    <span className="inline-flex items-center justify-center"><MdNotificationsNone className="text-base" /><span className="sr-only">Notificaciones de cambio</span></span>
                  </th>
                )}
                {hayAcciones && (
                  <th className="px-3 py-4 w-32 sticky right-0 z-10 bg-brand-navy">
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {currentItems.map((r, i) => {
                const adjuntos = adjuntosDe(r)
                const abierto = expandedId === r.codigo
                const estiloFila = colorRowsPorEstado
                  ? getRecoleccionBg(r.estado)
                  : i % 2 === 0
                    ? 'bg-white'
                    : 'bg-brand-cyan/10'
                return (
                  <Fragment key={r.codigo}>
                    <tr
                      onClick={() => abrirFila(r)}
                      className={`group ${seguimientoEnFila ? 'cursor-pointer active:animate-rowPop active:bg-brand-deep/30' : ''} transition-colors hover:bg-brand-deep/20 ${estiloFila}`}
                    >
                      <td className="px-3 py-3 text-center border-b border-l border-brand-ink/10">
                        <span className={`inline-flex items-center justify-center size-7 rounded-full text-xs font-extrabold ${i % 2 === 0 ? 'bg-brand-navy text-white' : 'bg-brand-deep text-white'}`}>
                          {startIndex + i + 1}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-bold text-brand-deep whitespace-nowrap border-b border-l border-brand-ink/10">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onRowClick?.(r) }}
                          title="Ver detalle completo"
                          aria-label="Ver detalle de la recolección"
                          className="inline-flex items-center gap-1 rounded-md text-brand-deep font-bold underline-offset-4 hover:underline decoration-brand-cyan decoration-2 hover:text-brand-deep/90 transition-colors"
                        >
                          {(r.codigo || '').toUpperCase()}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">
                        <span className="block">{r.fecha_subida || '—'}</span>
                        {r.hora_subida && <span className="block text-xs text-brand-ink/50">{r.hora_subida}</span>}
                      </td>
                      <td className="px-2 py-3 font-semibold text-brand-ink min-w-[150px] border-b border-l border-brand-ink/10">
                        <span className="block truncate whitespace-nowrap">{r.nombre_completo || '—'}</span>
                        {r.correo && (
                          <span className="block text-xs font-normal text-brand-ink/50 truncate whitespace-nowrap">{r.correo}</span>
                        )}
                      </td>
                      <td className="px-2 py-3 capitalize text-brand-ink/80 max-w-[150px] truncate whitespace-nowrap border-b border-l border-brand-ink/10" title={r.tipo_servicio || ''}>
                        {r.tipo_servicio || '—'}
                      </td>
                      <td className="px-2 py-3 capitalize text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">{r.zona || '—'}</td>
                      <td className="px-3 py-3 text-center border-b border-l border-brand-ink/10">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggle(r.codigo) }}
                          title="Ver qué recogemos y qué entregamos"
                          aria-label="Ver qué recogemos y qué entregamos"
                          aria-expanded={abierto}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${abierto ? 'bg-brand-cyan text-brand-ink' : 'bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink'}`}
                        >
                          <MdListAlt className="text-sm" />
                          Ver
                          <MdExpandMore className={`text-base transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                      <td className="px-2 py-3 text-brand-ink/80 max-w-[220px] border-b border-l border-brand-ink/10">
                        <span className="block truncate whitespace-nowrap" title={r.observaciones || ''}>{r.observaciones || '—'}</span>
                      </td>
                      <td className="px-2 py-3 text-brand-ink/80 whitespace-nowrap border-b border-l border-brand-ink/10">
                        {adjuntos.length > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setAdjuntosRecoleccion(r) }}
                            aria-label="Ver adjuntos"
                            title="Ver adjuntos"
                            className="inline-flex items-center gap-1 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors px-3 py-1.5 text-xs font-bold"
                          >
                            <MdAttachFile className="text-sm" />
                            {adjuntos.length} archivo(s)
                          </button>
                        ) : '—'}
                      </td>
                      <td className="px-2 py-3 border-b border-l border-brand-ink/10">
                        <AsignadoBadge asignado={r.asignado_a} />
                        {r.conductor && (
                          <span className="mt-1 block text-[11px] font-semibold text-brand-ink/60" title={`Conductor: ${r.conductor}`}>
                            Conductor: <span className="capitalize text-brand-ink/80">{r.conductor}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 border-b border-l border-brand-ink/10 text-center">
                        <EstadoBadge estado={r.estado} />
                      </td>
                      {mostrarNotificaciones && (
                        <td className="px-2 py-3 border-b border-l border-brand-ink/10 text-center">
                          <Campana r={r} />
                        </td>
                      )}
                      {hayAcciones && (
                        <td className={`px-3 py-3 border-b border-l border-brand-ink/10 sticky right-0 z-10 transition-colors group-hover:bg-brand-deep/20 ${estiloFila}`}>
                          <div className="flex items-center justify-center gap-1.5">
                            {onAsignarClick && !esTerminal(r) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onAsignarClick(r)
                                }}
                                title="Asignar usuario"
                                aria-label="Asignar usuario"
                                className="grid place-items-center size-9 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors"
                              >
                                <MdPersonAdd className="text-xl" />
                              </button>
                            )}
                            {onCambiarEstadoClick && !esTerminal(r) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (!tieneAsignado(r)) return
                                  onCambiarEstadoClick(r)
                                }}
                                disabled={!tieneAsignado(r)}
                                title={tieneAsignado(r) ? 'Cambiar estado' : 'Debes asignar una persona primero'}
                                aria-label="Cambiar estado"
                                className="grid place-items-center size-9 rounded-full bg-brand-navy/10 text-brand-deep hover:bg-brand-navy hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-navy/10 disabled:hover:text-brand-deep"
                              >
                                <MdSwapHoriz className="text-xl" />
                              </button>
                            )}
                            {onHistorialClick && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onHistorialClick(r)
                                }}
                                title="Historial"
                                aria-label="Ver historial"
                                className="grid place-items-center size-9 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors"
                              >
                                <MdHistory className="text-xl" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>

                    {abierto && (
                      <tr className={estiloFila}>
                        <td colSpan={columnas} className="px-3 pt-6 pb-6 border-b border-l border-brand-ink/10">
                          <PanelRecogeEntrega r={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-6 w-full max-w-full">
          <button
            type="button"
            onClick={() => setCurrentPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1 rounded-full bg-brand-navy text-white font-bold px-3 sm:px-5 py-2 sm:py-2.5 text-sm hover:bg-brand-deep transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MdNavigateBefore className="text-lg" />
            <span className="hidden sm:inline">Anterior</span>
          </button>
          <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 max-w-full min-w-0">
            {paginasVisibles(page, totalPages).map((p, i) =>
              p === '⬦' ? (
                <span key={`gap-${i}`} className="px-1 text-sm font-bold text-brand-ink/40">⬦</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`size-8 sm:size-9 shrink-0 rounded-full font-bold text-sm transition-all ${
                    page === p
                      ? 'bg-brand-cyan text-brand-ink shadow-cyanGlow'
                      : 'bg-white text-brand-ink border border-brand-ink/15 hover:bg-brand-deep/10'
                  }`}
                >
                  {p}
                </button>
              )
            )}
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
      )}

      <AdjuntosModal
        open={adjuntosRecoleccion !== null}
        onClose={() => setAdjuntosRecoleccion(null)}
        adjuntos={adjuntosRecoleccion ? adjuntosDe(adjuntosRecoleccion) : []}
      />

      <RecoleccionSeguimientoModal
        open={seguimiento !== null}
        recoleccion={seguimiento}
        onClose={() => setSeguimiento(null)}
        onCorregir={
          onCorregirClick
            ? (r) => {
                // Cierra el seguimiento antes de abrir el formulario de corrección.
                setSeguimiento(null)
                onCorregirClick(r)
              }
            : undefined
        }
      />
    </>
  )
}
