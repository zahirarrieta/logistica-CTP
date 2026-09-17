import { useState } from 'react'
import { MdClose, MdImage } from 'react-icons/md'
import VisorPdfModal from './VisorPdfModal.jsx'
import AdjuntoFileCard from './AdjuntoFileCard.jsx'

export default function AdjuntosModal({ open, onClose, adjuntos }) {
  const [pdfUrl, setPdfUrl] = useState(null)
  if (!open || !adjuntos || adjuntos.length === 0) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[1100] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 sm:px-4 py-4 sm:py-6 animate-fadeIn overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="relative bg-white text-brand-ink w-full max-w-4xl rounded-2xl shadow-2xl animate-scaleIn max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Adjuntos de la solicitud"
        >
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-brand-navy to-brand-deep flex items-center justify-between gap-3 shrink-0">
            <h3 className="text-white font-extrabold text-base sm:text-lg inline-flex items-center gap-2">
              <MdImage className="text-brand-cyan" />
              ADJUNTOS ({adjuntos.length})
            </h3>
            <button
              aria-label="Cerrar"
              onClick={onClose}
              className="grid place-items-center size-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            >
              <MdClose className="text-lg" />
            </button>
          </div>

          <div className="overflow-y-auto p-4 sm:p-6 space-y-4">
            {adjuntos.map((url, i) => (
              <AdjuntoFileCard key={i} url={url} index={i} onVerPdf={setPdfUrl} />
            ))}
          </div>
        </div>
      </div>

      <VisorPdfModal
        open={Boolean(pdfUrl)}
        url={pdfUrl}
        onClose={() => setPdfUrl(null)}
        titulo="VISTA PREVIA PDF"
      />
    </>
  )
}
