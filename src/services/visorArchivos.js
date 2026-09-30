// ============================================================================
// VISOR DE ARCHIVOS
// Resuelve lo que hay que abrir en el visor de PDF y en el carrusel de evidencia.
//
// Antes descargaba los archivos de OneDrive con un token de Graph, buscándolos
// por nombre dentro de la carpeta compartida. Ya no hay token de Graph, así que
// este módulo se limita a pasar la dirección: los archivos del backend llegan
// aquí como una URL firmada de 24 h, que el navegador carga directamente.
//
// Los archivos antiguos que siguen apuntando a OneDrive se detectan para poder
// avisar en lugar de mostrar un error de red: siguen en la base y no se pueden
// leer sin Graph. Es un caso real, no hipotético, porque hay registros
// anteriores a este cambio.
// ============================================================================

// Enlaces de OneDrive/SharePoint que quedaron en la base de datos. Se reconocen
// por el dominio, igual que antes.
export function esUrlOneDrive(url) {
  return (
    /^https?:\/\//i.test(url) &&
    /(sharepoint\.com|1drv\.ms|graph\.microsoft\.com)/i.test(url)
  )
}

function nombreDesdeUrl(url) {
  try {
    const path = new URL(url).pathname
    const ultimo = decodeURIComponent(path.split('/').pop() || '')
    return ultimo || 'Archivo'
  } catch {
    return String(url || '').split(',').pop().trim().split('/').pop() || 'Archivo'
  }
}

// Devuelve { src, nombre, abrir }. `src` es lo que se mete en el <iframe> o el
// <img>; `abrir`, el enlace para abrir en otra pestaña.
//
// Lanza si la dirección es un enlace de OneDrive heredado, con un mensaje que
// explica qué pasó: sin ese mensaje el usuario vería un error de red sin pista
// de que el problema es que el archivo quedó en el sistema anterior.
export async function resolverArchivo(url) {
  if (esUrlOneDrive(url)) {
    throw new Error(
      'Este archivo quedó en OneDrive y ya no se puede abrir: los archivos ahora se guardan en el servidor. Vuelve a adjuntarlo para que quede disponible.'
    )
  }
  if (!url || typeof url !== 'string') {
    throw new Error('No hay archivo para mostrar')
  }
  return { src: url, nombre: nombreDesdeUrl(url), abrir: url }
}
