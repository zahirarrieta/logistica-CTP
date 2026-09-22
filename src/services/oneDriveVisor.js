import { obtenerTokenGraph, resolverCarpetaRaiz } from './oneDriveApi.js'

const RAIZ = 'solicitudes'
const CARPETAS_CONOCIDAS = '(FacturasoRemisiones|DocEntregas)'

export function esUrlOneDrive(url) {
  return (
    /^https?:\/\//i.test(url) &&
    /(sharepoint\.com|1drv\.ms|graph\.microsoft\.com)/i.test(url)
  )
}

function base64Url(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
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

async function graphJson(ruta, token) {
  const resp = await fetch(`https://graph.microsoft.com/v1.0${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!resp.ok) throw new Error(`OneDrive respondió ${resp.status}`)
  return resp.json()
}

async function descargarItem(item, token, mime) {
  // El drive correcto es el del dueño del item (puede ser un OneDrive compartido).
  const driveId = item.parentReference && item.parentReference.driveId
  const base = driveId ? `/drives/${driveId}/items/` : '/me/drive/items/'
  const resp = await fetch(
    `https://graph.microsoft.com/v1.0${base}${encodeURIComponent(item.id)}/content`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!resp.ok) throw new Error(`OneDrive respondió ${resp.status}`)
  const buffer = await resp.arrayBuffer()
  return new Blob([buffer], mime ? { type: mime } : undefined)
}

async function resultado(item, token, mime, urlBase) {
  const blob = await descargarItem(item, token, mime)
  return {
    src: URL.createObjectURL(blob),
    nombre: item.name || nombreDesdeUrl(urlBase),
    abrir: item.webUrl || urlBase,
  }
}

// Resuelve una referencia (URL de OneDrive, enlace compartido o nombre de archivo
// guardado por versiones antiguas) a un blob reproducible en el navegador.
export async function resolverArchivoOneDrive(url, { carpeta = '', mime = '' } = {}) {
  if (!url) return { src: '', nombre: '', abrir: '' }

  const nombre = nombreDesdeUrl(url)

  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return { src: url, nombre, abrir: '' }
  }

  const token = await obtenerTokenGraph()
  const errores = []

  try {
    const raiz = await resolverCarpetaRaiz(token)

    if (/^https?:\/\//i.test(url)) {
      // 1) Ruta directa dentro de una carpeta conocida (OneDrive compartido)
      const match = url.match(new RegExp(`/${CARPETAS_CONOCIDAS}/([^/?&#]+)`, 'i'))
      if (match) {
        try {
          const archivo = decodeURIComponent(match[2]).split('?')[0]
          const item = await graphJson(
            `/drives/${raiz.driveId}/items/${raiz.rootId}:/${match[1]}/${encodeURIComponent(archivo)}`,
            token
          )
          return await resultado(item, token, mime, url)
        } catch (err) {
          console.warn('[OneDrive] ruta directa falló:', err.message)
          errores.push(err.message)
        }
      }
    } else if (carpeta) {
      // 3) Referencias antiguas: solo se guardó el nombre del archivo.
      try {
        const objetivo = url.split(',')[0].trim()
        const lista = await graphJson(
          `/drives/${raiz.driveId}/items/${raiz.rootId}:/${carpeta}:/children?$select=id,name,webUrl&$top=200`,
          token
        )
        const items = lista.value || []
        const item =
          items.find((c) => c.name === objetivo) ||
          items.find((c) => c.name.endsWith(`_${objetivo}`)) ||
          items.find((c) => c.name.includes(objetivo))
        if (!item) {
          console.warn(
            `[OneDrive] "${objetivo}" no está en ${carpeta}. Archivos:`,
            items.map((c) => c.name)
          )
          throw new Error('no se encontró el archivo en la carpeta')
        }
        return await resultado(item, token, mime, url)
      } catch (err) {
        console.warn('[OneDrive] búsqueda por nombre falló:', err.message)
        errores.push(err.message)
      }
    }

    // 2) Enlace compartido (sirve aunque el archivo esté en el OneDrive de otro usuario)
    if (/^https?:\/\//i.test(url)) {
      try {
        const item = await graphJson(`/shares/u!${base64Url(url)}/driveItem`, token)
        return await resultado(item, token, mime, url)
      } catch (err) {
        console.warn('[OneDrive] enlace compartido falló:', err.message)
        errores.push(err.message)
      }
    }
  } catch (err) {
    console.warn('[OneDrive] no se pudo resolver la carpeta compartida:', err.message)
    errores.push(err.message)
  }

  throw new Error(
    `No se pudo cargar el archivo desde OneDrive${errores.length ? ` (${errores.join(' · ')})` : ''}`
  )
}