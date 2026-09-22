import { msalInstance, getActiveAccount } from '../auth/msal.js'
import { graphTokenRequest } from '../auth/authConfig.js'

const CARPETA_FACTURAS = 'FacturasoRemisiones'
const CARPETA_ENTREGAS = 'DocEntregas'

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

async function asegurarCarpetaRaiz(token) {
  const probe = await fetch('https://graph.microsoft.com/v1.0/me/drive/root:/solicitudes', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (probe.ok) return
  if (probe.status !== 404) {
    throw new Error(`OneDrive: no se pudo verificar la carpeta solicitudes (${probe.status})`)
  }
  const crear = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'solicitudes', folder: {} }),
  })
  if (!crear.ok) {
    throw new Error(`OneDrive: no se pudo crear la carpeta solicitudes (${crear.status})`)
  }
  console.info('[OneDrive] carpeta raíz "solicitudes" creada')
}

async function asegurarCarpetaSolicitudes(token, nombre) {
  await asegurarCarpetaRaiz(token)
  const listar = await fetch(
    'https://graph.microsoft.com/v1.0/me/drive/root:/solicitudes:/children',
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!listar.ok) {
    throw new Error(`OneDrive: no se pudo leer la carpeta solicitudes (${listar.status})`)
  }
  const data = await listar.json()
  const existe = (data.value || []).some((c) => c.name === nombre && Boolean(c.folder))
  if (existe) return

  const crear = await fetch(
    'https://graph.microsoft.com/v1.0/me/drive/root:/solicitudes:/children',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: nombre, folder: {} }),
    }
  )
  if (!crear.ok) {
    throw new Error(`OneDrive: no se pudo crear la carpeta ${nombre} (${crear.status})`)
  }
}

export function asegurarCarpetaFacturas(token) {
  return asegurarCarpetaSolicitudes(token, CARPETA_FACTURAS)
}

export function asegurarCarpetaEntregas(token) {
  return asegurarCarpetaSolicitudes(token, CARPETA_ENTREGAS)
}

export async function subirFacturaRemisionOneDrive(archivos, numeroFactura) {
  if (!Array.isArray(archivos) || archivos.length === 0) return []

  const token = await obtenerTokenGraph()
  await asegurarCarpetaFacturas(token)

  const numero = sanitizarRuta(String(numeroFactura || '').trim() || 'SinNumero')
  const resultados = []

  for (const archivo of archivos) {
    const nombreArchivo = sanitizarRuta(archivo.name)
    const nombreDestino = `${numero}_${nombreArchivo}`
    const ruta = `/solicitudes/${CARPETA_FACTURAS}/${nombreDestino}`
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:${ruta}:/content`

    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': archivo.type || 'application/pdf',
      },
      body: archivo,
    })

    if (!resp.ok) {
      const detalle = await resp.text().catch(() => '')
      throw new Error(`OneDrive: error ${resp.status} subiendo ${archivo.name}${detalle ? ` — ${detalle}` : ''}`)
    }

    const data = await resp.json()
    resultados.push({
      nombre: nombreDestino,
      url: data.webUrl || data['@microsoft.graph.downloadUrl'] || '',
      cantidadBytes: archivo.size,
      tipo: archivo.type,
    })
    console.info(`[OneDrive] factura/remisión subida → ${data.webUrl || '(sin webUrl)'}`)
  }

  return resultados
}

export async function subirDocEntregaOneDrive(blob, referencia) {
  if (!blob) return null

  const token = await obtenerTokenGraph()
  await asegurarCarpetaEntregas(token)

  const base = sanitizarRuta(String(referencia || '').trim() || 'SinReferencia')
  const extension = (blob.type || '').includes('png') ? 'png' : 'jpg'
  const sufijo = Date.now().toString().slice(-6)
  const nombreDestino = `${base}_${sufijo}.${extension}`
  const ruta = `/solicitudes/${CARPETA_ENTREGAS}/${nombreDestino}`
  const url = `https://graph.microsoft.com/v1.0/me/drive/root:${ruta}:/content`

  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': blob.type || 'image/jpeg',
    },
    body: blob,
  })

  if (!resp.ok) {
    const detalle = await resp.text().catch(() => '')
    throw new Error(`OneDrive: error ${resp.status} subiendo la evidencia${detalle ? ` — ${detalle}` : ''}`)
  }

  const data = await resp.json()
  const webUrl = data.webUrl || data['@microsoft.graph.downloadUrl'] || ''
  console.info(`[OneDrive] evidencia de entrega subida → ${webUrl || '(sin webUrl)'}`)
  return { nombre: nombreDestino, url: webUrl }
}
