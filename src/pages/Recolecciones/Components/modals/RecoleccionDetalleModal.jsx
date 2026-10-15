import { useState } from 'react'
import {
  MdClose, MdStorefront, MdPlace, MdEvent, MdAccessTime, MdSupportAgent,
  MdWarehouse, MdNotes, MdPerson, MdEmail, MdCategory, MdPhone, MdAttachFile,
  MdTag,
} from 'react-icons/md'
import Modal from '../../../../components/Modal.jsx'
import AdjuntosModal from '../../../../components/AdjuntosModal.jsx'
import TablaQueRecogemos from '../../../../components/TablaQueRecogemos.jsx'
import { getBadgeColor } from '../../../../utils/estadoColors.js'

export function EstadoBadge({ estado }) {
  const clase = getBadgeColor(estado)
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-black/5 ${clase}`}>
      {estado}
    </span>
  )
}

function Dato({ label, valor, icon, full = false }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <p className="text-[0.7rem] font-bold uppercase tracking-wider text-brand-deep/70 inline-flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-sm text-brand-ink whitespace-pre-wrap break-words">
        {valor || <span className="text-brand-ink/40">—</span>}
      </p>
    </div>
  )
}

// Detalle de una recolección: SOLO información, sin botones de acción.
export default function RecoleccionDetalleModal({ open, recoleccion, onClose }) {
  const [adjuntosOpen, setAdjuntosOpen] = useState(false)

  if (!open || !recoleccion) return null

  const adjuntos = Array.isArray(recoleccion.adjuntos) ? recoleccion.adjuntos : []

  return (
    <>
      <Modal onClose={onClose}>
        <div
          className="relative bg-white text-brand-ink w-full max-w-4xl rounded-2xl shadow-2xl animate-scaleIn max-h-[92vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={`Recolección ${recoleccion.codigo}`}
        >
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
                <span className="grid place-items-center size-9 rounded-full bg-white/10 shrink-0">
                  <MdStorefront className="text-lg" />
                </span>
                <span className="truncate">DETALLE DE RECOLECCIÓN</span>
              </h3>
              <p className="text-white/70 text-xs mt-0.5">
                Registrada el {recoleccion.fecha_subida} · {recoleccion.hora_subida}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                title="Número de la recolección"
                className="inline-flex items-center gap-1 rounded-full bg-brand-cyan/15 ring-1 ring-brand-cyan/40 text-brand-cyan px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-sm font-bold tracking-wide select-none shadow-[0_0_14px_rgba(0,229,255,0.25)]"
              >
                <MdTag className="text-xs sm:text-sm" />
                {(recoleccion.codigo || '').toUpperCase()}
              </span>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={onClose}
                className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
              >
                <MdClose className="text-lg" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto p-4 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Dato label="Solicitante" valor={recoleccion.nombre_completo} icon={<MdPerson className="text-sm" />} />
              <Dato label="Correo" valor={recoleccion.correo} icon={<MdEmail className="text-sm" />} />
              <Dato label="Zona" valor={recoleccion.zona} icon={<MdPlace className="text-sm" />} />
              <Dato label="Tipo de Servicio" valor={recoleccion.tipo_servicio} icon={<MdCategory className="text-sm" />} />
              <Dato label="Persona de contacto" valor={recoleccion.persona_contacto} icon={<MdSupportAgent className="text-sm" />} />
              <Dato label="Teléfono de contacto" valor={recoleccion.telefono_contacto} icon={<MdPhone className="text-sm" />} />
            </div>

            <div className="rounded-2xl border border-brand-deep/15 bg-brand-mist/30 p-4 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-deep inline-flex items-center gap-2">
                <MdStorefront /> Recolección
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Dato label="¿Dónde recogemos?" valor={recoleccion.recoge_cliente} icon={<MdStorefront className="text-sm" />} />
                <Dato label="Bodega" valor={recoleccion.recoge_bodega} icon={<MdWarehouse className="text-sm" />} />
                <Dato label="Fecha de recolección" valor={recoleccion.fecha_recoleccion} icon={<MdEvent className="text-sm" />} />
                <Dato label="Hora de recolección" valor={recoleccion.hora_recoleccion} icon={<MdAccessTime className="text-sm" />} />
              </div>
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-wider text-brand-deep/70 inline-flex items-center gap-1.5 mb-1.5">
                  <MdNotes className="text-sm" /> Qué recogemos
                </p>
                <TablaQueRecogemos texto={recoleccion.que_recogemos} compacto />
              </div>
            </div>

            <div className="rounded-2xl border border-brand-deep/15 bg-brand-mist/30 p-4 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-deep inline-flex items-center gap-2">
                <MdWarehouse /> Entrega
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Dato label="¿Dónde entregamos?" valor={recoleccion.entrega_cliente} icon={<MdWarehouse className="text-sm" />} />
                <Dato label="Bodega" valor={recoleccion.entrega_bodega} icon={<MdWarehouse className="text-sm" />} />
              </div>
            </div>

            <Dato label="Instrucción especial / observaciones" valor={recoleccion.observaciones} icon={<MdNotes className="text-sm" />} full />

            <div className="rounded-2xl border border-brand-deep/15 p-4">
              <p className="text-[0.7rem] font-bold uppercase tracking-wider text-brand-deep/70 inline-flex items-center gap-1.5 mb-2">
                <MdAttachFile className="text-sm" /> Adjuntos
              </p>
              {adjuntos.length === 0 ? (
                <p className="text-sm text-brand-ink/40">Sin adjuntos</p>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdjuntosOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors px-4 py-2 text-sm font-bold"
                >
                  <MdAttachFile className="text-lg" />
                  Ver adjuntos ({adjuntos.length})
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-brand-deep/15 p-4">
              <p className="text-[0.7rem] font-bold uppercase tracking-wider text-brand-deep/70 mb-1.5">Estado</p>
              <EstadoBadge estado={recoleccion.estado} />
            </div>
          </div>
        </div>
      </Modal>

      <AdjuntosModal
        open={adjuntosOpen}
        onClose={() => setAdjuntosOpen(false)}
        adjuntos={adjuntos}
      />
    </>
  )
}
