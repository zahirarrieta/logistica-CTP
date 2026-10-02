import { useState } from 'react'
import { MdClose, MdImage } from 'react-icons/md'
import VisorPdfModal from './VisorPdfModal.jsx'
import VisorImagen from './VisorImagen.jsx'
import AdjuntoFileCard from './AdjuntoFileCard.jsx'
import { esImagenUrl } from '../utils/tipoArchivo.js'

export default function AdjuntosModal({ open, onClose, adjuntos }) {
  const [pdfUrl, setPdfUrl] = useState(null)
  const [imagenUrl, setImagenUrl] = useState(null)
  if (!open || !adjuntos || adjuntos.length === 0) return null

  // Galería: el visor de imágenes necesita la lista completa para poder pasar de
  // una foto a otra sin cerrar.
  const imagenes = adjuntos.filter(esImagenUrl)

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
              <AdjuntoFileCard
                key={i}
                url={url}
                index={i}
                onVerPdf={setPdfUrl}
                urlsImagenes={imagenes}
                onVerImagen={setImagenUrl}
              />
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

      {/* UN solo visor para todas las fotos, hermano del modal y no dentro de él.
          Antes cada tarjeta montaba el suyo: quedaba dentro de la tarjeta, que al
          llevar `animate-scaleIn` hace de bloque contenedor del `fixed`, y por eso
          el visor salía encogido dentro del modal de adjuntos y recortado.
          VisorImagen se monta además en document.body, así que queda siempre a
          pantalla completa por encima de todo. Al cerrarlo se vuelve a este modal. */}
      <VisorImagen
        open={Boolean(imagenUrl)}
        url={imagenUrl || undefined}
        urls={imagenes}
        inicio={Math.max(imagenes.indexOf(imagenUrl), 0)}
        onClose={() => setImagenUrl(null)}
        titulo="VISTA PREVIA DE LA IMAGEN"
      />
    </>
  )
}
