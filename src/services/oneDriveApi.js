import { msalInstance, getActiveAccount } from '../auth/msal.js'
import { graphTokenRequest } from '../auth/authConfig.js'

async function obtenerTokenGraph() {
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

export async function subirAdjuntosOneDrive(archivos, correo, idSolicitud) {
  if (!Array.isArray(archivos) || archivos.length === 0) return []

  const token = await obtenerTokenGraph()
  const carpetaUsuario = sanitizarRuta(correo || 'sin-correo')
  const carpetaSolicitud = sanitizarRuta(idSolicitud)
  const resultados = []

  for (const archivo of archivos) {
    const nombre = sanitizarRuta(archivo.name)
    const ruta = `/solicitudes/${carpetaUsuario}/${carpetaSolicitud}/${nombre}`
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:${ruta}:/content`

    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': archivo.type || 'application/octet-stream',
      },
      body: archivo,
    })

    if (!resp.ok) {
      const detalle = await resp.text().catch(() => '')
      throw new Error(`OneDrive: error ${resp.status} subiendo ${archivo.name}${detalle ? ` — ${detalle}` : ''}`)
    }

    const data = await resp.json()
    resultados.push({
      nombre: archivo.name,
      url: data.webUrl || data['@microsoft.graph.downloadUrl'] || '',
      tamaño: archivo.size,
      tipo: archivo.type,
    })
    console.info(`[OneDrive] subido ${archivo.name} → ${data.webUrl || '(sin webUrl)'}`)
  }

  return resultados
}
