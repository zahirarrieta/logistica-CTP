import { useEffect, useState } from 'react'
import {
  MdClose, MdStorefront, MdPlace, MdEvent, MdAccessTime, MdSupportAgent,
  MdWarehouse, MdNotes, MdPerson, MdEmail, MdCategory, MdPhone, MdAttachFile,
  MdOpenInNew, MdSave, MdTag, MdErrorOutline,
} from 'react-icons/md'
import Modal from '../../../../components/Modal.jsx'
import { ESTADOS_RECOLECCION } from '../../../../auth/roles.js'

const ESTADO_BADGE = {
  Abierto: 'bg-blue-100 text-blue-700 ring-blue-200',
  'Trámite': 'bg-amber-100 text-amber-700 ring-amber-200',
  Fallido: 'bg-red-100 text-red-700 ring-red-200',
  Entregado: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
}

export function EstadoBadge({ estado }) {
  const clase = ESTADO_BADGE[estado] || 'bg-brand-ink/10 text-brand-ink ring-brand-ink/20'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${clase}`}>
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

export default function RecoleccionDetalleModal({ open, recoleccion, puedeEditar, onClose, onSave }) {
  const [estado, setEstado] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !recoleccion) return
    setEstado(recoleccion.estado || 'Abierto')
    setError('')
    setGuardando(false)
  }, [open, recoleccion])

  if (!open || !recoleccion) return null

  const cambiar = estado !== (recoleccion.estado || 'Abierto')

  const guardar = async () => {
    if (!cambiar) return
    setGuardando(true)
    setError('')
    try {
      await onSave(recoleccion.codigo, { estado })
      setGuardando(false)
    } catch (e) {
      setError(e?.message || 'No se pudo actualizar el estado')
      setGuardando(false)
    }
  }

  const adjuntos = Array.isArray(recoleccion.adjuntos) ? recoleccion.adjuntos : []

  return (
    <Modal onClose={guardando ? undefined : onClose}>
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
              disabled={guardando}
              className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
            >
              <MdClose className="text-lg" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6 space-y-5">
          {error && (
            <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-700 flex items-start gap-2">
              <MdErrorOutline className="text-lg shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

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
              <Dato label="Qué recogemos" valor={recoleccion.que_recogemos} icon={<MdNotes className="text-sm" />} full />
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

          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-wider text-brand-deep/70 inline-flex items-center gap-1.5">
              <MdAttachFile className="text-sm" /> Adjuntos
            </p>
            {adjuntos.length === 0 ? (
              <p className="mt-0.5 text-sm text-brand-ink/40">Sin adjuntos</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {adjuntos.map((url, i) => {
                  const esUrl = /^https?:\/\//i.test(url)
                  const nombre = decodeURIComponent(String(url).split('/').pop() || `Adjunto ${i + 1}`)
                  return (
                    <li key={`${url}-${i}`}>
                      {esUrl ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-deep hover:text-brand-cyan hover:underline"
                        >
                          <MdOpenInNew />
                          {nombre}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-sm text-brand-ink/70">
                          <MdAttachFile />
                          {nombre}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-brand-deep/15 p-4">
            <p className="text-[0.7rem] font-bold uppercase tracking-wider text-brand-deep/70 mb-1.5">Estado</p>
            {puedeEditar ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  disabled={guardando}
                  className="w-full sm:max-w-xs px-3 py-2.5 rounded-xl bg-white border border-brand-deep/20 shadow-sm focus:outline-none focus:border-brand-deep/60 focus:ring-4 focus:ring-brand-deep/10 text-brand-ink font-medium disabled:opacity-60"
                >
                  {ESTADOS_RECOLECCION.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={guardar}
                  disabled={guardando || !cambiar}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-cyan px-5 py-2.5 text-sm font-bold text-brand-ink shadow-cyanGlow hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] transition disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  <MdSave className="text-lg" />
                  {guardando ? 'Guardando…' : 'Guardar estado'}
                </button>
              </div>
            ) : (
              <EstadoBadge estado={recoleccion.estado} />
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
