import { useEffect, useState } from 'react'
import { MdClose, MdPictureAsPdf, MdOpenInNew, MdDownload, MdCloudQueue } from 'react-icons/md'
import { resolverArchivoOneDrive } from '../services/oneDriveVisor.js'

const CARPETA = 'solicitudes/FacturasoRemisiones'

function esUrlAbsoluta(url) {
  return /^https?:\/\//i.test(url)
}

export default function VisorPdfModal({ open, url, onClose, titulo }) {
  const [src, setSrc] = useState('')
  const [nombre, setNombre] = useState('')
  const [abrir, setAbrir] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let objectUrl = null
    let cancelado = false
    setCargando(true)
    setError('')
    setNombre('')
    setAbrir('')
    const tiempoLimite = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tiempo de espera agotado al cargar el PDF')), 25000)
    })
    Promise.race([
      resolverArchivoOneDrive(url, { carpeta: CARPETA, mime: 'application/pdf' }),
      tiempoLimite,
    ])
      .then((res) => {
        if (cancelado) return
        if (res.src.startsWith('blob:')) objectUrl = res.src
        setSrc(res.src)
        setNombre(res.nombre)
        setAbrir(res.abrir || '')
      })
      .catch((err) => {
        if (cancelado) return
        console.error('[VisorPdf] error:', err)
        setError(err.message || 'No se pudo cargar el documento')
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setSrc('')
    }
  }, [open, url])

  if (!open || !url) return null

  const enlaceExterno = abrir || (esUrlAbsoluta(url) ? url : '')

  return (
    <div
      className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white text-brand-ink w-full max-w-4xl rounded-2xl shadow-2xl animate-scaleIn h-[92vh] max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Vista previa del PDF"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2 min-w-0">
            <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shadow-cyanGlow shrink-0">
              <MdPictureAsPdf className="text-brand-cyan text-lg" />
            </span>
            <span className="truncate">{titulo || 'VISTA PREVIA PDF'}</span>
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {enlaceExterno && (
              <a
                href={enlaceExterno}
                target="_blank"
                rel="noopener noreferrer"
                className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/25 transition"
                title="Abrir en otra pestaña"
                aria-label="Abrir en otra pestaña"
              >
                <MdOpenInNew className="text-lg" />
              </a>
            )}
            {src && (
              <a
                href={src}
                download={nombre || true}
                className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/25 transition"
                title="Descargar"
                aria-label="Descargar"
              >
                <MdDownload className="text-lg" />
              </a>
            )}
            <button
              aria-label="Cerrar"
              onClick={onClose}
              className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/25 transition"
            >
              <MdClose className="text-lg" />
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="relative flex-1 min-h-0 bg-brand-deep/5 p-2 sm:p-3">
          {cargando && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-brand-mist/50">
              <MdCloudQueue className="text-4xl text-brand-cyan animate-pulse" />
              <p className="text-sm font-bold text-brand-deep">Cargando PDF…</p>
            </div>
          )}
          {error ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
              <MdPictureAsPdf className="text-5xl text-red-500" />
              <p className="text-sm font-bold text-red-600">{error}</p>
              <p className="text-xs text-brand-ink/60">La vista previa no está disponible para este documento.</p>
              {enlaceExterno && (
                <a
                  href={enlaceExterno}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-cyan px-4 py-2 text-sm font-bold text-brand-ink shadow-cyanGlow"
                >
                  <MdOpenInNew className="text-lg" />
                  Abrir en otra pestaña
                </a>
              )}
            </div>
          ) : src ? (
            <iframe
              title={nombre || 'Vista previa del PDF'}
              src={src}
              className="w-full h-full rounded-xl bg-white border border-brand-ink/10"
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
