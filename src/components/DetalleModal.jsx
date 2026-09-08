import { MdClose, MdTag, MdCalendarToday, MdAccessTime, MdPerson, MdEmail, MdAssignmentAdd, MdBusiness, MdWarehouse, MdPlace, MdAttachFile, MdNotes, MdAssignmentInd } from 'react-icons/md'
import { getBadgeColor, getDotColor } from '../pages/Home/Components/estadoColors.js'
import { nombreDeAsignado } from '../pages/Home/Components/solicitudesStore.js'

function Row({ icon, label, value }) {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-brand-ink/5 last:border-0">
      <span className="text-brand-cyan mt-0.5 shrink-0">{icon}</span>
      <span className="text-brand-ink/50 w-28 shrink-0 text-xs sm:text-sm">{label}</span>
      <span className="text-brand-ink font-medium capitalize break-words">{text || '—'}</span>
    </div>
  )
}

export default function DetalleModal({ solicitud, open, onClose }) {
  if (!open || !solicitud) return null

  const asignado = nombreDeAsignado(solicitud.asignadoA)

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-md rounded-2xl shadow-2xl animate-scaleIn max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de la solicitud"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 sticky top-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
            <span className="grid place-items-center size-9 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow">
              <MdTag className="text-brand-cyan text-lg" />
            </span>
            DETALLE SOLICITUD
          </h3>
          <button
            aria-label="Cerrar"
            onClick={onClose}
            className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <MdClose className="text-lg" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-ink/5 border border-brand-ink/10 px-3 py-1.5 text-xs sm:text-sm font-bold text-brand-deep">
              <MdTag className="text-brand-cyan" />
              {solicitud.id}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${getBadgeColor(solicitud.estado || 'Abierto')}`}>
              <span className={`size-2 rounded-full ${getDotColor(solicitud.estado || 'Abierto')}`} />
              {solicitud.estado || 'Abierto'}
            </span>
          </div>

          <div>
            <Row icon={<MdCalendarToday />} label="Fecha" value={solicitud.fechaSubida || solicitud.fecha} />
            <Row icon={<MdAccessTime />} label="Hora" value={solicitud.horaSubida || '—'} />
            <Row icon={<MdPerson />} label="Nombre" value={solicitud.nombreCompleto} />
            <Row icon={<MdEmail />} label="Correo" value={solicitud.correo} />
            <Row icon={<MdAssignmentAdd />} label="Tipo" value={solicitud.tipoSolicitud} />
            <Row icon={<MdBusiness />} label="Cliente" value={solicitud.cliente} />
            <Row icon={<MdWarehouse />} label="Bodega" value={solicitud.bodega} />
            <Row icon={<MdTag />} label="NIT" value={solicitud.nit} />
            <Row icon={<MdPlace />} label="Zona" value={solicitud.zona} />
            <Row icon={<MdAttachFile />} label="Adjuntos" value={solicitud.adjuntos?.length > 0 ? `${solicitud.adjuntos.length} archivo(s)` : '—'} />
            <Row icon={<MdNotes />} label="Observaciones" value={solicitud.observaciones} />
            <Row icon={<MdAssignmentInd />} label="Asignado a" value={asignado || 'Sin asignar'} />
          </div>
        </div>
      </div>
    </div>
  )
}