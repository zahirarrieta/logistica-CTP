import { MdOpenInNew } from 'react-icons/md'
import AdjuntoFileCard from './AdjuntoFileCard.jsx'
import { esPdfUrl } from '../utils/pdfUtils.js'
import { esImagenUrl, esExcelUrl } from '../utils/tipoArchivo.js'
import { abrirArchivo } from '../services/visorArchivos.js'

export default function AdjuntoEnlace({ adjunto, onVerPdf }) {
  const urls = String(adjunto || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
  if (urls.length === 0) return null
  // Las fotos de una misma entrega se ven juntas en el visor: sin esto, el visor
  // solo recibía la foto de su tarjeta y para pasar a la otra había que cerrar.
  const imagenes = urls.filter(esImagenUrl)
  return (
    <div className="mt-2 space-y-2">
      {urls.map((u, i) =>
        // PDF, imagen y hoja van con la tarjeta: cada uno con su visualizador. Antes
        // la foto y la hoja caían en el enlace suelto de abajo, así que no se
        // podían ver sin salir de la pantalla.
        esPdfUrl(u) || esImagenUrl(u) || esExcelUrl(u) ? (
          <AdjuntoFileCard key={i} url={u} index={i} onVerPdf={onVerPdf} urlsImagenes={imagenes} />
        ) : (
          <button
            key={i}
            type="button"
            onClick={() => abrirArchivo(u, 'nueva')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-deep underline decoration-brand-cyan underline-offset-2 break-all text-left"
          >
            <MdOpenInNew className="shrink-0" />
            {u}
          </button>
        )
      )}
    </div>
  )
}