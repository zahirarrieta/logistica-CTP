import { useRef, useState } from 'react'
import {
  MdClose,
  MdDescription,
  MdAccessTime,
  MdTimeline,
  MdPerson,
  MdLocalShipping,
  MdDirectionsCar,
  MdTag,
  MdImage,
  MdEvent,
  MdPictureAsPdf,
} from 'react-icons/md'
import { getBadgeColor } from '../../../Home/Components/estadoColors.js'
import { nombreDeAsignado, buscarEntrega } from '../../../Home/Components/solicitudesStore.js'
import { tiempoEntrega, formatHoras } from '../dashboardUtils.js'
import EntregaInfo from '../../../../components/EntregaInfo.jsx'
import AdjuntosModal from '../../../../components/AdjuntosModal.jsx'
import AdjuntoEnlace from '../../../../components/AdjuntoEnlace.jsx'
import VisorPdfModal from '../../../../components/VisorPdfModal.jsx'

const enTransito = (s) => ['En Tránsito', 'En Tránsito Parcial'].includes(s.estado)

const adjuntosVisibles = (s) => {
  if (enTransito(s)) {
    if (s.nuevaFacturaUrls?.length) return s.nuevaFacturaUrls
    if (s.adjuntosTramite?.length) return s.adjuntosTramite
  }
  return s.adjuntos
}

function Dato({ label, value }) {
  return (
    <div className="rounded-xl border border-brand-ink/10 bg-brand-mist/40 px-3 py-2.5 min-w-0">
      <span className="block text-[10px] font-extrabold uppercase tracking-wide text-brand-ink/50">{label}</span>
      <span className="mt-1 block truncate text-sm font-bold text-brand-deep" title={String(value ?? '—')}>
        {value || '—'}
      </span>
    </div>
  )
}

export default function PedidoDetalleModal({ solicitud, open, onClose }) {
  const [verAdjuntos, setVerAdjuntos] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [exportando, setExportando] = useState(false)
  const detalleRef = useRef(null)
  if (!open || !solicitud) return null

  const entrega = buscarEntrega(solicitud)
  const temporal = tiempoEntrega(solicitud)
  const adjuntos = adjuntosVisibles(solicitud)
  const historial = Array.isArray(solicitud.historial) ? solicitud.historial : []

  const exportarPdf = async () => {
    if (!detalleRef.current || exportando) return
    setExportando(true)
    try {
      const [h2c, jspdf] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
      const html2canvas = h2c.default || h2c
      const jsPDF = jspdf.jsPDF || jspdf.default
      const canvas = await html2canvas(detalleRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: detalleRef.current.scrollWidth,
      })
      const doc = new jsPDF('p', 'mm', 'a4')
      const anchoPagina = doc.internal.pageSize.getWidth()
      const altoPagina = doc.internal.pageSize.getHeight()
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      const altoImg = (canvas.height * anchoPagina) / canvas.width
      let heightLeft = altoImg
      let position = 0
      doc.addImage(imgData, 'JPEG', 0, position, anchoPagina, altoImg)
      heightLeft -= altoPagina
      while (heightLeft > 0) {
        position -= altoPagina
        doc.addPage()
        doc.addImage(imgData, 'JPEG', 0, position, anchoPagina, altoImg)
        heightLeft -= altoPagina
      }
      const fecha = new Date().toISOString().slice(0, 10)
      doc.save(`${solicitud.id || 'pedido'}_${fecha}.pdf`)
    } catch (error) {
      console.error('[PedidoDetalle] no se pudo exportar el PDF:', error)
    } finally {
      setExportando(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-3xl rounded-2xl overflow-hidden bg-white shadow-2xl animate-scaleIn max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <header className="relative shrink-0 bg-gradient-to-r from-brand-navy to-brand-deep px-4 sm:px-6 py-4 flex items-center gap-3">
            <span className="grid place-items-center size-10 shrink-0 rounded-xl bg-white/10 text-brand-cyan shadow-cyanGlow">
              <MdDescription className="text-xl" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">Detalle del pedido</h3>
              <p className="text-[11px] sm:text-xs text-white/60 truncate">
                Solicitud <span className="font-bold text-brand-cyan">{solicitud.id}</span> · {solicitud.estado || 'Abierto'}
              </p>
            </div>
            <button
              onClick={exportarPdf}
              disabled={exportando}
              className="grid place-items-center size-8 shrink-0 rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
              title={exportando ? 'Exportando…' : 'Exportar este pedido en PDF'}
            >
              <MdPictureAsPdf className="text-lg" />
            </button>
            <button
              onClick={onClose}
              className="grid place-items-center size-8 shrink-0 rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
              title="Cerrar"
            >
              <MdClose className="text-lg" />
            </button>
          </header>

          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto" ref={detalleRef}>
            {/* Estado + tiempos */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-brand-ink/10 bg-brand-mist/40 px-4 py-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${getBadgeColor(solicitud.estado || 'Abierto')}`}>
                {solicitud.estado || 'Abierto'}
              </span>
              {temporal ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-brand-deep">
                  <MdAccessTime className="text-brand-cyan" />
                  Tiempo de entrega: {formatHoras(temporal.horas)}
                </span>
              ) : (
                <span className="text-xs font-bold text-brand-ink/50">Aún no se ha entregado</span>
              )}
              <span className="sm:ml-auto text-xs font-semibold text-brand-ink/50">
                Creado {solicitud.fechaSubida || '—'} · {solicitud.horaSubida || '—'}
              </span>
            </div>

            {/* Datos generales */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Dato label="Tipo de solicitud" value={solicitud.tipoSolicitud} />
              <Dato label="Cliente" value={solicitud.cliente} />
              <Dato label="Bodega" value={solicitud.bodega} />
              <Dato label="NIT" value={solicitud.nit} />
              <Dato label="Zona" value={solicitud.zona} />
              <Dato label="Nº referencia" value={solicitud.numeroReferencia} />
            </div>

            {/* Asignación */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Dato label="Asignado a" value={nombreDeAsignado(solicitud.asignadoA)} />
              <Dato label="Conductor" value={solicitud.conductor} />
              <Dato label="Vehículo" value={solicitud.vehiculo} />
              <Dato label="Placa" value={solicitud.placa} />
            </div>

            {/* Observaciones */}
            {solicitud.observaciones && (
              <div>
                <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-brand-deep mb-2">Observaciones</h4>
                <p className="rounded-xl bg-brand-mist/60 border-l-2 border-brand-cyan px-3.5 py-2.5 text-sm text-brand-ink/80 whitespace-pre-wrap">
                  {solicitud.observaciones}
                </p>
              </div>
            )}

            {/* Adjuntos */}
            {adjuntos && adjuntos.length > 0 && (
              <div>
                <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-brand-deep mb-2 flex items-center gap-1.5">
                  <MdImage className="text-brand-cyan" /> Adjuntos ({adjuntos.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setVerAdjuntos(true)}
                  className="rounded-xl border border-brand-ink/10 bg-brand-mist/40 px-4 py-2.5 text-sm font-bold text-brand-deep hover:bg-brand-mist transition flex items-center gap-2"
                >
                  <MdImage className="text-brand-cyan" />
                  Ver los {adjuntos.length} archivo(s)
                </button>
              </div>
            )}

            {/* Entrega */}
            {entrega && <EntregaInfo solicitud={solicitud} entrega={entrega} />}

            {/* Historial */}
            {historial.length > 0 && (
              <div>
                <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-brand-deep mb-3 flex items-center gap-1.5">
                  <MdTimeline className="text-brand-cyan" /> Historial ({historial.length})
                </h4>
                <div className="space-y-2">
                  {historial.map((h, i) => (
                    <div
                      key={h.id || i}
                      className="rounded-xl border border-brand-ink/10 bg-brand-mist/40 px-3.5 py-2.5 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold ${getBadgeColor(h.nuevo)}`}>
                          {h.nuevo}
                        </span>
                        {h.anterior && h.anterior !== h.nuevo && (
                          <span className="text-[11px] font-bold text-brand-ink/40">desde {h.anterior}</span>
                        )}
                        <span className="ml-auto text-[11px] font-bold text-brand-ink/50 flex items-center gap-1">
                          <MdEvent className="text-brand-cyan" /> {h.fecha} · {h.hora}
                        </span>
                      </div>
                      {h.persona && <p className="mt-1 text-xs font-semibold text-brand-ink/60">Registró: {h.persona}</p>}
                      {h.nota && <p className="mt-1.5 text-xs text-brand-ink/80 whitespace-pre-wrap">«{h.nota}»</p>}
                      {h.referencia && (
                        <p className="mt-1.5 text-[11px] font-bold text-brand-ink/50 flex items-center gap-1 flex-wrap">
                          <MdPerson className="text-brand-cyan" /> Nº referencia: {h.referencia}
                        </p>
                      )}
                      {h.adjunto && <AdjuntoEnlace adjunto={h.adjunto} onVerPdf={setPdfUrl} />}
                      {(h.conductor || h.vehiculo || h.placa) && (
                        <p className="mt-1 text-[11px] font-bold text-brand-ink/50 flex items-center gap-1 flex-wrap">
                          <MdLocalShipping className="text-brand-cyan" /> {h.conductor}
                          <MdDirectionsCar className="text-brand-cyan" /> {h.vehiculo}
                          <MdTag className="text-brand-cyan" /> {h.placa}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <footer className="shrink-0 bg-brand-mist border-t border-brand-ink/10 px-4 sm:px-6 py-3 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-full bg-brand-navy text-white text-sm font-bold px-5 py-2.5 hover:bg-brand-deep transition-colors shadow-sm"
            >
              Cerrar
            </button>
          </footer>
        </div>
      </div>

      <AdjuntosModal open={verAdjuntos} onClose={() => setVerAdjuntos(false)} adjuntos={adjuntos} />

      <VisorPdfModal
        open={Boolean(pdfUrl)}
        url={pdfUrl}
        onClose={() => setPdfUrl(null)}
        titulo="VISTA PREVIA PDF"
      />
    </>
  )
}