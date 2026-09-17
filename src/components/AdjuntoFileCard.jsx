import { MdImage, MdPictureAsPdf, MdInsertDriveFile, MdTableChart, MdOpenInNew, MdDownload, MdVisibility } from 'react-icons/md'
import { esPdfUrl, nombrePdfFromUrl } from './pdfUtils.js'

function esImagen(url) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url)
}

function esExcel(url) {
  return /\.xlsx?(\?.*)?$/i.test(url)
}

function nombreArchivo(url) {
  try {
    const path = new URL(url).pathname
    const parts = path.split('/')
    return decodeURIComponent(parts[parts.length - 1] || 'Archivo')
  } catch {
    return String(url || '').split('/').pop() || 'Archivo'
  }
}

function esUrlAbsoluta(url) {
  return /^https?:\/\//i.test(url)
}

function iconoDe(url) {
  if (esImagen(url)) return <MdImage className="text-blue-500 text-xl shrink-0" />
  if (esPdfUrl(url)) return <MdPictureAsPdf className="text-red-500 text-xl shrink-0" />
  if (esExcel(url)) return <MdTableChart className="text-green-600 text-xl shrink-0" />
  return <MdInsertDriveFile className="text-brand-deep text-xl shrink-0" />
}

export default function AdjuntoFileCard({ url, index, onVerPdf }) {
  const nombre = nombreArchivo(url) || nombrePdfFromUrl(url)
  const esPdf = esPdfUrl(url)

  return (
    <div className="rounded-xl border border-brand-ink/15 overflow-hidden bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-brand-mist/50 border-b border-brand-ink/10">
        <div className="flex items-center gap-2 min-w-0">
          {iconoDe(url)}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-brand-ink truncate">{nombre}</span>
            {typeof index === 'number' && <span className="text-[10px] text-brand-ink/50">Archivo {index + 1}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {esPdf && onVerPdf && (
            <button
              type="button"
              onClick={() => onVerPdf(url)}
              className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 hover:bg-red-600 hover:text-white transition-colors px-3 py-1.5 text-xs font-bold"
            >
              <MdVisibility className="text-sm" />
              Ver PDF
            </button>
          )}
          {esUrlAbsoluta(url) && (
            <>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-brand-navy text-white hover:bg-brand-deep transition-colors px-3 py-1.5 text-xs font-bold"
                onClick={(e) => e.stopPropagation()}
              >
                <MdOpenInNew className="text-sm" />
                Abrir
              </a>
              <a
                href={url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-brand-cyan/15 text-brand-deep hover:bg-brand-cyan hover:text-brand-ink transition-colors px-3 py-1.5 text-xs font-bold"
                onClick={(e) => e.stopPropagation()}
              >
                <MdDownload className="text-sm" />
                Descargar
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}