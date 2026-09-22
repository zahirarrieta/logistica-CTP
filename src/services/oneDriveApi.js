import { msalInstance, getActiveAccount } from '../auth/msal.js'
import { graphTokenRequest } from '../auth/authConfig.js'
import { carpetaNoCompartida } from './notificaciones.jsx'

const CARPETA_FACTURAS = 'FacturasoRemisiones'
const CARPETA_ENTREGAS = 'DocEntregas'
const BASE = 'https://graph.microsoft.com/v1.0'

export async function obtenerTokenGraph() {
  const account = getActiveAccount()
  if (!account) throw new Error('No hay sesión de Microsoft activa')

  try {
    const resp = await msalInstance.acquireTokenSilent({
      ...graphTokenRequest,
      account,
    })
    return resp.accessToken
  } catch (err) {
    console.warn('[OneDrive] token silencioso falló, intentando popup:', err.message)
    const resp = await msalInstance.acquireTokenPopup(graphTokenRequest)
    return resp.accessToken
  }
}

function sanitizarRuta(segmento) {
  return segmento.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_')
}

function cabeceras(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra }
}

// ---------------------------------------------------------------------------
// Carpetas: todo vive en la carpeta raíz "solicitudes" del OneDrive COMPARTIDO
// (la de sistemas@ctpmedica.com). El usuario autenticado la puede tener en su
// propio drive o compartida con él; en ambos casos los archivos quedan en la
// misma carpeta para que todos los vean/editen.
// ---------------------------------------------------------------------------
let carpetaRaizCache = null

export async function resolverCarpetaRaiz(token) {
  if (carpetaRaizCache) return carpetaRaizCache

  // Prioridad 1: la carpeta compartida conmigo (la central de sistemas@ctpmedica.com).
  try {
    const compartidos = await fetch(`${BASE}/me/drive/sharedWithMe`, {
      headers: cabeceras(token),
    })
    if (compartidos.ok) {
      const data = await compartidos.json()
      const item = (data.value || []).find(
        (x) => x.remoteItem?.name?.toLowerCase() === 'solicitudes' && Boolean(x.remoteItem.folder)
      )
      const driveId = item?.remoteItem?.parentReference?.driveId
      if (item && driveId) {
        carpetaRaizCache = {
          driveId,
          rootId: item.remoteItem.id,
          nombre: item.remoteItem.name,
        }
        return carpetaRaizCache
      }
    }
  } catch (err) {
    console.warn('[OneDrive] no se pudieron listar las carpetas compartidas:', err.message)
  }

  // Prioridad 2: por si el usuario es el dueño (tiene la carpeta en su drive).
  try {
    const enMiDrive = await fetch(`${BASE}/me/drive/root:/solicitudes`, {
      headers: cabeceras(token),
    })
    if (enMiDrive.ok) {
      const folder = await enMiDrive.json()
      carpetaRaizCache = {
        driveId: folder.parentReference?.driveId,
        rootId: folder.id,
        nombre: folder.name,
      }
      return carpetaRaizCache
    }
  } catch (err) {
    console.warn('[OneDrive] no se pudo revisar la carpeta en mi drive:', err.message)
  }

  carpetaNoCompartida()
  throw new Error(
    "OneDrive: no se encontró la carpeta compartida 'solicitudes'. Compártela con tu cuenta para poder subir y ver documentos."
  )
}

async function raizPara(token) {
  const raiz = await resolverCarpetaRaiz(token)
  if (!raiz.driveId || !raiz.rootId) {
    throw new Error("OneDrive: no se pudo ubicar la carpeta compartida 'solicitudes'.")
  }
  return raiz
}

// Obtiene la subcarpeta {nombre} bajo {raiz}; si no existe la crea.
// Devuelve el id del item (carpeta) creado/encontrado.
async function asegurarSubcarpeta(token, raiz, nombre) {
  const consulta = `${BASE}/drives/${raiz.driveId}/items/${raiz.rootId}:/${encodeURIComponent(nombre)}`
  const existente = await fetch(consulta, { headers: cabeceras(token) })
  if (existente.ok) {
    const item = await existente.json()
    return item.id
  }
  if (existente.status !== 404) {
    throw new Error(`OneDrive: error ${existente.status} al revisar la carpeta ${nombre}`)
  }

  const crear = await fetch(`${BASE}/drives/${raiz.driveId}/items/${raiz.rootId}/children`, {
    method: 'POST',
    headers: cabeceras(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name: nombre, folder: {} }),
  })
  if (!crear.ok) {
    throw new Error(`OneDrive: no se pudo crear la carpeta ${nombre} (${crear.status})`)
  }
  const item = await crear.json()
  console.info(`[OneDrive] carpeta "${nombre}" creada`)
  return item.id
}

// Sube {body} como {nombre} dentro de la carpeta {padreId} de {driveId}.
async function subirArchivo(token, driveId, padreId, nombre, body, mime) {
  const url = `${BASE}/drives/${driveId}/items/${padreId}:/${encodeURIComponent(nombre)}:/content`
  const resp = await fetch(url, {
    method: 'PUT',
    headers: cabeceras(token, { 'Content-Type': mime }),
    body,
  })
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => '')
    throw new Error(
      `OneDrive: error ${resp.status} subiendo ${nombre}${detalle ? ` — ${detalle}` : ''}`
    )
  }
  const data = await resp.json()
  return { nombre: data.name || nombre, url: data.webUrl || data['@microsoft.graph.downloadUrl'] || '' }
}

export async function subirAdjuntosOneDrive(archivos, correo, idSolicitud) {
  if (!Array.isArray(archivos) || archivos.length === 0) return []

  const token = await obtenerTokenGraph()
  const raiz = await raizPara(token)
  const carpetaUsuario = sanitizarRuta(correo || 'sin-correo')
  const carpetaSolicitud = sanitizarRuta(idSolicitud)
  const idUsuario = await asegurarSubcarpeta(token, raiz, carpetaUsuario)
  const idSolicitudCarpeta = await asegurarSubcarpeta(
    token,
    { driveId: raiz.driveId, rootId: idUsuario },
    carpetaSolicitud
  )

  const resultados = []
  for (const archivo of archivos) {
    const subido = await subirArchivo(
      token,
      raiz.driveId,
      idSolicitudCarpeta,
      sanitizarRuta(archivo.name),
      archivo,
      archivo.type || 'application/octet-stream'
    )
    resultados.push({
      nombre: archivo.name,
      url: subido.url,
      tamaño: archivo.size,
      tipo: archivo.type,
    })
    console.info(`[OneDrive] subido ${archivo.name} → ${subido.url || '(sin webUrl)'}`)
  }

  return resultados
}

export async function asegurarCarpetaFacturas(token) {
  const raiz = await raizPara(token)
  return asegurarSubcarpeta(token, raiz, CARPETA_FACTURAS)
}

export async function asegurarCarpetaEntregas(token) {
  const raiz = await raizPara(token)
  return asegurarSubcarpeta(token, raiz, CARPETA_ENTREGAS)
}

export async function subirFacturaRemisionOneDrive(archivos, numeroFactura) {
  if (!Array.isArray(archivos) || archivos.length === 0) return []

  const token = await obtenerTokenGraph()
  const raiz = await raizPara(token)
  const idFacturas = await asegurarSubcarpeta(token, raiz, CARPETA_FACTURAS)

  const numero = sanitizarRuta(String(numeroFactura || '').trim() || 'SinNumero')
  const resultados = []

  for (const archivo of archivos) {
    const nombreArchivo = sanitizarRuta(archivo.name)
    const nombreDestino = `${numero}_${nombreArchivo}`
    const subido = await subirArchivo(
      token,
      raiz.driveId,
      idFacturas,
      nombreDestino,
      archivo,
      archivo.type || 'application/pdf'
    )
    resultados.push({
      nombre: nombreDestino,
      url: subido.url,
      cantidadBytes: archivo.size,
      tipo: archivo.type,
    })
    console.info(`[OneDrive] factura/remisión subida → ${subido.url || '(sin webUrl)'}`)
  }

  return resultados
}

export async function subirDocEntregaOneDrive(blob, referencia) {
  if (!blob) return null

  const token = await obtenerTokenGraph()
  const raiz = await raizPara(token)
  const idEntregas = await asegurarSubcarpeta(token, raiz, CARPETA_ENTREGAS)

  const base = sanitizarRuta(String(referencia || '').trim() || 'SinReferencia')
  const extension = (blob.type || '').includes('png') ? 'png' : 'jpg'
  const sufijo = Date.now().toString().slice(-6)
  const nombreDestino = `${base}_${sufijo}.${extension}`

  const subido = await subirArchivo(
    token,
    raiz.driveId,
    idEntregas,
    nombreDestino,
    blob,
    blob.type || 'image/jpeg'
  )
  console.info(`[OneDrive] evidencia de entrega subida → ${subido.url || '(sin webUrl)'}`)
  return { nombre: nombreDestino, url: subido.url }
}