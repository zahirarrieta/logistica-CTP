import { extensionDe } from './tipoArchivo.js'

export function esPdfUrl(url) {
  if (!url) return false
  // La extensión se lee del archivo real, tanto si viene en una URL normal como
  // dentro del query de la URL firmada del backend (…ver?ruta=…pdf&exp=…) o en un
  // data URL. Antes el patrón exigía ? # o el final detrás del .pdf, y con la
  // firma —que pone &— el PDF no coincidía y se tomaba por una imagen.
  if (extensionDe(url) === 'pdf') return true
  // Carpeta de facturas/remisiones
  if (String(url).includes('FacturasoRemisiones')) return true
  return false
}

const CARPETA_FACTURAS = /\/FacturasoRemisiones\//i

export function esUrlFactura(url) {
  return typeof url === 'string' && CARPETA_FACTURAS.test(url)
}

// Los adjuntos de la solicitud son solo los cargados al crearla. Las facturas o
// remisiones del trámite viven en el historial, no en la lista de adjuntos.
export function soloAdjuntosSolicitud(lista) {
  return (Array.isArray(lista) ? lista : []).filter((u) => typeof u === 'string' && !esUrlFactura(u))
}

// Tope de PDFs de factura/remisión por SOLICITUD, no por tanda. Una solicitud
// puede pasar varias veces por «En Trámite» y el total nunca pasa de 3.
export const MAXE_PDFS_TRAMITE = 3

// PDFs de todas las tandas de «En Trámite», de la más antigua a la más reciente.
// Cada vez que se reimprime «En Trámite» el historial guarda una entrada propia
// con sus PDFs y su comentario, así que aquí se concatenan todas. Antes se leía
// solo la última tanda y las anteriores quedaban ocultas.
export function pdfsTramite(historial) {
  const lista = Array.isArray(historial) ? historial : []
  const urls = []
  // El historial se guarda del más nuevo al más viejo: se recorre al revés para
  // devolver las tandas en orden cronológico.
  for (let i = lista.length - 1; i >= 0; i -= 1) {
    const h = lista[i]
    if (!h || h.campo !== 'estado' || h.nuevo !== 'En Trámite') continue
    String(h.adjunto || '')
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean)
      .forEach((u) => urls.push(u))
  }
  return urls
}

export function nombrePdfFromUrl(url, fallback) {
  if (!url) return fallback || 'Documento PDF'
  if (url.startsWith('blob:') || url.startsWith('data:')) return fallback || 'Documento PDF'
  try {
    const urlObj = new URL(url)
    // La URL firmada del backend manda la ruta en «ruta»; «id» era de una versión
    // anterior. Sin lo de «ruta» el nombre salía del pathname, que acaba en
    // /ver, y el PDF se descargaba como ver.pdf.
    const desdeQuery = urlObj.searchParams.get('ruta') || urlObj.searchParams.get('id')
    const ruta = desdeQuery ? desdeQuery.split('?')[0] : urlObj.pathname
    const partes = ruta.split('/').filter(Boolean)
    const ultimo = partes[partes.length - 1]
    if (!ultimo) return fallback || 'Documento PDF'
    try {
      return decodeURIComponent(ultimo)
    } catch {
      return ultimo
    }
  } catch {
    return fallback || 'Documento PDF'
  }
}