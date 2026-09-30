export function esPdfUrl(url) {
  if (!url) return false
  // PDF directo
  if (/\.pdf([?#]|$)/i.test(url)) return true
  // Carpeta de facturas/remisiones
  if (String(url).includes('FacturasoRemisiones')) return true
  // URL firmada del backend: /api/archivos/ver?ruta=...pdf... -> extraer ruta y mirar extensión
  try {
    const u = new URL(url, 'http://x')
    const ruta = u.searchParams.get('ruta') || ''
    if (/\.pdf([?#]|$)/i.test(ruta)) return true
  } catch {
    // ignorar
  }
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

export function nombrePdfFromUrl(url, fallback) {
  if (!url) return fallback || 'Documento PDF'
  if (url.startsWith('blob:') || url.startsWith('data:')) return fallback || 'Documento PDF'
  try {
    const urlObj = new URL(url)
    const id = urlObj.searchParams.get('id')
    const ruta = id ? id.split('?')[0] : urlObj.pathname
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