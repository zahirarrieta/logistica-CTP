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

// Margen de seguridad: si a la firma le quedan menos de 5 minutos se considera
// caducada y se re-firma, para no abrir un documento que expirará mientras se ve.
const MARGEN_CADUCIDAD_MS = 5 * 60 * 1000

// Una URL firmada del backend es /api/archivos/ver?ruta=...&exp=<unix seg>&firma=...
// Devuelve la `ruta` cruda si la URL es de esas y su `exp` ya venció (o vence en
// menos del margen); si no, devuelve null. Es lo que permite re-firmar bajo
// demanda un enlace que se guardó firmado en el caché hace días.
function rutaFirmadaCaducada(url) {
  if (!/\/api\/archivos\/ver\?/i.test(url)) return null
  let params
  try {
    params = new URL(url, 'http://x').searchParams
  } catch {
    return null
  }
  const ruta = params.get('ruta')
  if (!ruta) return null
  const exp = Number(params.get('exp'))
  if (!Number.isFinite(exp)) return null
  const caducada = exp * 1000 < Date.now() + MARGEN_CADUCIDAD_MS
  return caducada ? ruta : null
}

// ¿Se puede meter tal cual en un <img>/<iframe> sin pasar por resolverArchivo?
// Solo si ya es una dirección lista Y, cuando es una URL firmada del backend, aún
// no caducó. Una firma vencida devuelve false para que el visor la re-firme: si se
// pintara directa, el navegador mostraría «Enlace inválido o vencido».
export function sePuedeMostrarDirecto(url) {
  return esDireccionLista(url) && !rutaFirmadaCaducada(url)
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
  // Enlace firmado del backend que YA CADUCÓ: se rescata la ruta cruda de la URL
  // y se re-firma abajo. Esto pasa cuando el caché guardó hace días una URL firmada
  // (24 h de vigencia) y el archivo sigue en disco en la misma ruta.
  const caducada = rutaFirmadaCaducada(url)
  // Ya viene firmada y vigente (o es un blob/data): se usa tal cual, sin red.
  if (!caducada && esDireccionLista(url)) {
    return { src: url, nombre: nombreDesdeUrl(url), abrir: url }
  }
  // Es una RUTA cruda del backend, o una URL firmada caducada de la que rescatamos
  // la ruta. Pasa cuando el documento se acaba de subir en esta misma sesión (el
  // store guarda la ruta y solo se firma al re-descargar) o al abrir un archivo
  // cuyo enlace firmado ya expiró. Se firma aquí bajo demanda para que el visor no
  // se quede cargando una ruta relativa que el navegador no puede resolver ni
  // muestre «Enlace inválido o vencido».
  const firmada = await firmarRuta(caducada || url)
  if (!firmada) {
    throw new Error(
      'El documento aún no está disponible en el servidor. Cierra y vuelve a abrir la solicitud, o recarga la página, para intentarlo de nuevo.'
    )
  }
  return { src: firmada, nombre: nombreDesdeUrl(firmada), abrir: firmada }
}
