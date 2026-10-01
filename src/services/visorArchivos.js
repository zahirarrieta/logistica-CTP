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

import { firmarRuta } from './archivosApi.js'

// Enlaces de OneDrive/SharePoint que quedaron en la base de datos. Se reconocen
// por el dominio, igual que antes.
export function esUrlOneDrive(url) {
  return (
    /^https?:\/\//i.test(url) &&
    /(sharepoint\.com|1drv\.ms|graph\.microsoft\.com)/i.test(url)
  )
}

// Dirección ya utilizable por el navegador: http(s), blob o data. Todo lo demás
// es una RUTA cruda del backend ({usuario}/{codigo}/.../archivo.pdf) que hay que
// firmar antes de poder verla.
export function esDireccionLista(url) {
  return /^(https?:|blob:|data:)/i.test(url)
}

function nombreDesdeUrl(url) {
  try {
    // URL firmada: extraer nombre de la ruta
    const u = new URL(url, 'http://x')
    const ruta = u.searchParams.get('ruta') || ''
    if (ruta) {
      const parts = ruta.split('/').filter(Boolean)
      const ultimo = parts[parts.length - 1]
      if (ultimo) return decodeURIComponent(ultimo)
    }
  } catch {
    // ignorar
  }
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
  // Ya viene firmada (o es un blob/data): se usa tal cual.
  if (esDireccionLista(url)) {
    return { src: url, nombre: nombreDesdeUrl(url), abrir: url }
  }
  // Es una RUTA cruda del backend. Pasa cuando el documento se acaba de subir en
  // esta misma sesión: el store guarda la ruta y solo se firma al re-descargar.
  // Se firma aquí bajo demanda para que el visor no se quede cargando una ruta
  // relativa que el navegador no puede resolver.
  const firmada = await firmarRuta(url)
  if (!firmada) {
    throw new Error(
      'El documento aún no está disponible en el servidor. Cierra y vuelve a abrir la solicitud, o recarga la página, para intentarlo de nuevo.'
    )
  }
  return { src: firmada, nombre: nombreDesdeUrl(firmada), abrir: firmada }
}
