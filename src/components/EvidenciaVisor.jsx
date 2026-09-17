import { useEffect, useState } from 'react'
import {
  MdPictureAsPdf,
  MdPhotoCamera,
  MdVerified,
  MdCloudQueue,
  MdClose,
  MdOpenInNew,
  MdDownload,
  MdZoomIn,
} from 'react-icons/md'
import { esUrlOneDrive, resolverArchivoOneDrive } from '../services/oneDriveVisor.js'

const CARPETA = 'solicitudes/DocEntregas'

export default function EvidenciaVisor({ url }) {
  const esOneDrive = esUrlOneDrive(url)
  const esPdf = /^data:application\/pdf/i.test(url) || /\.pdf(\?|#|$)/i.test(url)
  const [src, setSrc] = useState(esOneDrive ? '' : url)
  const [abrir, setAbrir] = useState(url)
  const [cargando, setCargando] = useState(esOneDrive)
  const [error, setError] = useState('')
  const [ampliado, setAmpliado] = useState(false)

  useEffect(() => {
    if (!esOneDrive) {
      setSrc(url)
      setAbrir(url)
      setError('')
      setCargando(false)
      return
    }
    let objectUrl = null
    let cancelado = false
    setCargando(true)
    setError('')
    resolverArchivoOneDrive(url, { carpeta: CARPETA })
      .then((res) => {
        if (cancelado) return
        if (res.src.startsWith('blob:')) objectUrl = res.src
        setSrc(res.src)
        if (res.abrir) setAbrir(res.abrir)
      })
      .catch((err) => {
        if (cancelado) return
        console.error('[Evidencia] error:', err)
        setError(err.message || 'No se pudo cargar la evidencia')
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url, esOneDrive])

  useEffect(() => {
    if (!ampliado) return
    const alTeclear = (e) => {
      if (e.key === 'Escape') setAmpliado(false)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [ampliado])

  if (esPdf) {
    return (
      <a
        href={abrir}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-xl border border-brand-ink/10 bg-brand-mist/40 px-4 py-3.5 hover:bg-brand-cyan/10 hover:border-brand-cyan transition-colors"
      >
        <MdPictureAsPdf className="text-3xl text-red-600 shrink-0" />
        <span className="min-w-0">
          <span className="block text-sm font-extrabold text-brand-deep">Documento PDF de la entrega</span>
          <span className="block text-xs text-brand-ink/60">Clic para abrir en una nueva pestaña</span>
        </span>
      </a>
    )
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-brand-ink/10 bg-brand-mist/40 px-4 py-8 text-sm font-bold text-brand-deep">
        <MdCloudQueue className="text-xl text-brand-cyan animate-pulse" />
        Cargando evidencia…
      </div>
    )
  }

  if (error || !src) {
    return (
      <a
        href={abrir}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-xl border border-brand-ink/10 bg-brand-mist/40 px-4 py-3.5 hover:bg-brand-cyan/10 hover:border-brand-cyan transition-colors"
      >
        <MdPhotoCamera className="text-3xl text-brand-deep shrink-0" />
        <span className="min-w-0">
          <span className="block text-sm font-extrabold text-brand-deep">Evidencia de la entrega</span>
          <span className="block text-xs text-brand-ink/60">Clic para abrirla en una nueva pestaña</span>
        </span>
      </a>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAmpliado(true)}
        title="Ver la evidencia en grande"
        className="group relative block w-full rounded-xl overflow-hidden border border-brand-ink/10 bg-brand-ink/5 cursor-zoom-in"
      >
        <img
          src={src}
          alt="Evidencia de la entrega"
          className="w-full max-h-72 object-contain transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 text-white px-3 py-1 text-[11px] font-bold">
          <MdVerified className="text-sm text-green-400" /> Foto de la entrega
        </span>
        <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 text-white px-3 py-1 text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
          <MdZoomIn className="text-sm" /> Ver en grande
        </span>
      </button>

      {ampliado && (
        <div
          className="fixed inset-0 z-[1300] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
          onClick={() => setAmpliado(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Evidencia de la entrega"
        >
          <div
            className="relative w-full max-w-6xl max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 pb-3">
              <h3 className="text-white font-extrabold text-sm sm:text-base inline-flex items-center gap-2 min-w-0">
                <span className="grid place-items-center size-8 rounded-xl bg-brand-cyan/20 ring-1 ring-brand-cyan/40 shrink-0">
                  <MdPhotoCamera className="text-brand-cyan text-lg" />
                </span>
                <span className="truncate">EVIDENCIA DE LA ENTREGA</span>
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={src}
                  download
                  className="grid place-items-center size-9 rounded-full bg-white/10 text-white hover:bg-white/25 transition"
                  title="Descargar"
                  aria-label="Descargar"
                >
                  <MdDownload className="text-lg" />
                </a>
                {abrir && (
                  <a
                    href={abrir}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid place-items-center size-9 rounded-full bg-white/10 text-white hover:bg-white/25 transition"
                    title="Abrir en otra pestaña"
                    aria-label="Abrir en otra pestaña"
                  >
                    <MdOpenInNew className="text-lg" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setAmpliado(false)}
                  className="grid place-items-center size-9 rounded-full bg-white/10 text-white hover:bg-white/25 transition"
                  title="Cerrar"
                  aria-label="Cerrar"
                >
                  <MdClose className="text-lg" />
                </button>
              </div>
            </div>
            <img
              src={src}
              alt="Evidencia de la entrega"
              className="w-full max-h-[82vh] object-contain rounded-xl bg-white/5"
            />
          </div>
        </div>
      )}
    </>
  )
}
