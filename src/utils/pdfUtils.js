export function esPdfUrl(url) {
  if (!url) return false
  const s = String(url)
  // PDF incrustado: el tipo va en la cabecera data:, no en el nombre. Sin esto un
  // PDF en base 64 se tomaba por una imagen y salía el icono de imagen rota.
  if (/^data:application\/pdf/i.test(s)) return true
  // PDF directo. Ojo con el carácter después del .pdf: en la URL firmada del
  // backend la extensión va seguida de «&» (ver?ruta=...pdf&exp=...), así que si
  // el patrón solo admite ? # o el final NO la reconoce.
  if (/\.pdf([?&#]|$)/i.test(s)) return true
  // Carpeta de facturas/remisiones
  if (s.includes('FacturasoRemisiones')) return true
  // URL firmada del backend: /api/archivos/ver?ruta=...pdf&exp=... -> extraer ruta y
  // mirar la extensión. Se mantiene aunque el caso anterior ya lo cubra, por si el
  // nombre llega codificado.
  try {
    const u = new URL(s, 'http://x')
    const ruta = u.searchParams.get('ruta') || ''
    if (/\.pdf([?&#]|$)/i.test(ruta)) return true
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