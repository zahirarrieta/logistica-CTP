import { MdOpenInNew } from 'react-icons/md'
import AdjuntoFileCard from './AdjuntoFileCard.jsx'
import { esPdfUrl } from './pdfUtils.js'

export default function AdjuntoEnlace({ adjunto, onVerPdf }) {
  const urls = String(adjunto || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
  if (urls.length === 0) return null
  return (
    <div className="mt-2 space-y-2">
      {urls.map((u, i) =>
        esPdfUrl(u) ? (
          <AdjuntoFileCard key={i} url={u} index={i} onVerPdf={onVerPdf} />
        ) : (
          <a
            key={i}
            href={u}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-deep underline decoration-brand-cyan underline-offset-2 break-all"
          >
            <MdOpenInNew className="shrink-0" />
            {u}
          </a>
        )
      )}
    </div>
  )
}