import { useEffect, useState } from 'react'
import { MdClose, MdPerson, MdWork, MdEmail, MdNotes, MdImage, MdPictureAsPdf, MdVerified, MdStar } from 'react-icons/md'
import StarRating from '../../../../components/StarRating.jsx'
import { safeText } from '../../../Home/Components/solicitudesStore.js'

export default function EntregaDetallesModal({ solicitud, open, onClose }) {
  const [entrega, setEntrega] = useState(null)

  useEffect(() => {
    if (!solicitud) return
    const hist = Array.isArray(solicitud.historial) ? solicitud.historial : []
    const found = [...hist].reverse().find((h) => h.campo === 'estado' && (h.nuevo === 'Entregado' || h.nuevo === 'Entregado Parcial'))
    setEntrega(found || null)
  }, [solicitud])

  const esPdf = (url) => typeof url === 'string' && url.startsWith('data:application/pdf')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-slideUp">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-ink/10">
          <h2 className="text-xl font-bold text-brand-deep">Detalles de la entrega</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-brand-cyan/10 text-brand-ink/60 transition-colors"
            aria-label="Cerrar"
          >
            <MdClose className="text-2xl" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {!entrega ? (
            <div className="text-center py-12 text-brand-ink/60">
              <MdVerified className="text-4xl text-brand-cyan mx-auto mb-3" />
              <p className="text-lg">No hay datos de entrega registrados</p>
              <p className="text-sm mt-1">Esta solicitud no tiene historial de estado "Entregado" o "Entregado Parcial".</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-brand-ink/50 uppercase tracking-wider mb-1">Encuestado</label>
                  <div className="flex items-center gap-2">
                    <MdPerson className="text-brand-cyan" />
                    <span className="font-medium text-brand-deep">{safeText(entrega.nombreEncuestado) || '—'}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-ink/50 uppercase tracking-wider mb-1">Cargo</label>
                  <div className="flex items-center gap-2">
                    <MdWork className="text-brand-cyan" />
                    <span className="font-medium text-brand-deep">{safeText(entrega.cargo) || '—'}</span>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-brand-ink/50 uppercase tracking-wider mb-1">Correo</label>
                  <div className="flex items-center gap-2">
                    <MdEmail className="text-brand-cyan" />
                    <a href={`mailto:${safeText(entrega.correo)}`} className="text-brand-deep underline hover:text-brand-navy">{safeText(entrega.correo) || '—'}</a>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-brand-ink/50 uppercase tracking-wider mb-1">Observaciones</label>
                <div className="bg-brand-cyan/5 rounded-xl p-4 min-h-[80px]">
                  <MdNotes className="text-brand-cyan mb-2" />
                  <p className="text-brand-ink whitespace-pre-wrap">{safeText(entrega.nota) || 'Sin observaciones'}</p>
                </div>
              </div>

              {entrega.evidencia && (
                <div>
                  <label className="block text-xs font-medium text-brand-ink/50 uppercase tracking-wider mb-2">Evidencia</label>
                  <div className="rounded-xl border border-brand-ink/10 overflow-hidden">
                    {esPdf(entrega.evidencia) ? (
                      <a
                        href={entrega.evidencia}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-3 p-6 bg-brand-cyan/5 hover:bg-brand-cyan/10 transition-colors"
                      >
                        <MdPictureAsPdf className="text-4xl text-red-600" />
                        <div className="text-left">
                          <p className="font-medium text-brand-deep">PDF de la entrega</p>
                          <p className="text-sm text-brand-ink/60">Clic para abrir en nueva pestaña</p>
                        </div>
                      </a>
                    ) : (
                      <img
                        src={entrega.evidencia}
                        alt="Evidencia de entrega"
                        className="w-full h-auto max-h-[400px] object-contain bg-brand-ink/5"
                      />
                    )}
                  </div>
                </div>
              )}

              {entrega.encuesta && entrega.encuesta.preguntas?.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-brand-ink/50 uppercase tracking-wider mb-3">Encuesta de satisfacción</label>
                  <div className="space-y-4">
                    {entrega.encuesta.preguntas.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-4 flex-wrap">
                        <span className="text-sm text-brand-ink/70 min-w-[200px]">{p.pregunta}</span>
                        <div className="flex items-center gap-3">
                          <StarRating value={p.puntuacion || 0} disabled />
                          <span className="text-lg font-bold text-brand-navy w-8 text-center">{p.puntuacion || 0}</span>
                          <MdStar className="text-xl text-amber-500" />
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-brand-ink/10 flex items-center gap-3">
                      <span className="text-sm font-medium text-brand-ink/70">Promedio:</span>
                      <StarRating value={entrega.encuesta.promedio || 0} disabled />
                      <span className="text-xl font-bold text-brand-navy">{entrega.encuesta.promedio?.toFixed(1) || '0.0'}</span>
                      <MdStar className="text-xl text-amber-500" />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-brand-ink/10 grid gap-2 sm:grid-cols-3 text-sm text-brand-ink/60">
                <div><span className="font-medium">Recibió:</span> {safeText(entrega.persona) || '—'}</div>
                <div><span className="font-medium">Conductor:</span> {safeText(entrega.conductor) || safeText(solicitud.conductor) || '—'}</div>
                <div><span className="font-medium">Vehículo / Placa:</span> {safeText(entrega.vehiculo) || safeText(solicitud.vehiculo) || '—'} / {safeText(entrega.placa) || safeText(solicitud.placa) || '—'}</div>
                <div className="sm:col-span-2"><span className="font-medium">Fecha / Hora:</span> {safeText(entrega.fecha) || '—'} · {safeText(entrega.hora) || '—'}</div>
                <div><span className="font-medium">Referencia:</span> {safeText(entrega.referencia) || '—'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}