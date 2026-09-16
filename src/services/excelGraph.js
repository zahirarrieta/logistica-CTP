import { getActiveAccount, msalInstance } from '../auth/msal.js'

const BASE = 'https://graph.microsoft.com/v1.0'

export const EXCEL_CONFIG = {
  sitio: (import.meta.env.VITE_EXCEL_SITIO || '').trim(),
  itemId: (import.meta.env.VITE_EXCEL_ARCHIVO || '').trim(),
  ruta: (import.meta.env.VITE_EXCEL_RUTA || '').trim(),
  hoja: (import.meta.env.VITE_EXCEL_HOJA || 'Hoja1').trim(),
  tabla: (import.meta.env.VITE_EXCEL_TABLA || 'Solicitudes').trim(),
}

export const excelConfigurado = () => Boolean(EXCEL_CONFIG.itemId || EXCEL_CONFIG.ruta)

function scopes() {
  return [EXCEL_CONFIG.sitio ? 'Sites.ReadWrite.All' : 'Files.ReadWrite']
}

let tokenCache = null

async function accessToken() {
  if (tokenCache && tokenCache.expira > Date.now() + 60_000) return tokenCache.valor
  const account = getActiveAccount()
  if (!account) throw new Error('No hay sesión de Microsoft activa')
  const opciones = { scopes: scopes(), account }
  let resultado
  try {
    resultado = await msalInstance.acquireTokenSilent(opciones)
  } catch {
    resultado = await msalInstance.acquireTokenPopup(opciones)
  }
  tokenCache = {
    valor: resultado.accessToken,
    expira: resultado.expiresOn ? resultado.expiresOn.getTime() : Date.now() + 3_000_000,
  }
  return resultado.accessToken
}

let sesion = null
let rutaWorkbook = null

async function llamar(method, url, body) {
  const token = await accessToken()
  const respuesta = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(sesion ? { 'Workbook-Session-Id': sesion } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    const error = new Error(`Excel ${respuesta.status}: ${detalle.slice(0, 180)}`)
    error.status = respuesta.status
    throw error
  }
  if (respuesta.status === 204) return null
  return respuesta.json()
}

async function ejecutar(method, path, body) {
  const url = `${BASE}${await workbookPath()}${path}`
  try {
    if (!sesion) {
      const creada = await llamar('POST', `${BASE}${await workbookPath()}/createSession`, {
        persistChanges: true,
      })
      sesion = creada?.id || null
    }
    return await llamar(method, url, body)
  } catch (error) {
    if (sesion && [400, 401, 404, 409].includes(error.status)) {
      sesion = null
      return llamar(method, url, body)
    }
    throw error
  }
}

async function resolverSitio() {
  const sitio = EXCEL_CONFIG.sitio
  if (!sitio) return '/me'
  if (sitio.includes(',') || !sitio.includes('/')) return `/sites/${sitio}`
  const [host, ...resto] = sitio.split('/')
  const info = await llamar('GET', `${BASE}/sites/${host}:/${resto.join('/')}`, undefined)
  return `/sites/${info.id}`
}

async function workbookPath() {
  if (rutaWorkbook) return rutaWorkbook
  const raiz = await resolverSitio()
  rutaWorkbook = EXCEL_CONFIG.itemId
    ? `${raiz}/drive/items/${EXCEL_CONFIG.itemId}/workbook`
    : `${raiz}/drive/root:${EXCEL_CONFIG.ruta.startsWith('/') ? '' : '/'}${EXCEL_CONFIG.ruta}:/workbook`
  return rutaWorkbook
}

function letraColumna(total) {
  let letra = ''
  let n = total
  while (n > 0) {
    letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra
    n = Math.floor((n - 1) / 26)
  }
  return letra
}

function rango(path) {
  return `/worksheets('${EXCEL_CONFIG.hoja}')/range(address='${path}')`
}

function tablaPath(nombre = EXCEL_CONFIG.tabla) {
  return `/tables/${encodeURIComponent(nombre)}`
}

function primeraFilaDe(address) {
  const m = String(address).replace(/.*!/, '').match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/)
  return m ? Number(m[2]) : 1
}

async function leerFilas() {
  let url = `${BASE}${await workbookPath()}${tablaPath()}/rows?$select=index,values&$top=500`
  const filas = []
  do {
    const pagina = await llamar('GET', url, undefined)
    filas.push(...(pagina?.value || []))
    url = pagina?.['@odata.nextLink'] || null
  } while (url && filas.length < 5000)
  return filas
}

async function asegurarTabla(headers, primeraFila) {
  try {
    const tabla = await ejecutar('GET', tablaPath())
    return primeraFilaDe(tabla.address)
  } catch (error) {
    if (error.status !== 404) throw error
  }
  const ultima = letraColumna(headers.length)
  await ejecutar('PATCH', rango(`A1:${ultima}1`), { values: [headers] })
  await ejecutar('PATCH', rango(`A2:${ultima}2`), { values: [primeraFila] })
  const creada = await ejecutar('POST', `/worksheets('${EXCEL_CONFIG.hoja}')/tables/add`, {
    address: `A1:${ultima}2`,
    hasHeaders: true,
  })
  if (creada?.name !== EXCEL_CONFIG.tabla) {
    await ejecutar('PATCH', tablaPath(creada.name), { name: EXCEL_CONFIG.tabla })
  }
  return primeraFilaDe(creada.address)
}

export async function upsertFila(headers, fila) {
  const id = String(fila[0])
  const filaInicial = await asegurarTabla(headers, fila)
  const filas = await leerFilas()
  const ultima = letraColumna(headers.length)
  const posicion = filas.findIndex((f) => String(f.values?.[0] ?? '') === id)
  if (posicion < 0) {
    await ejecutar('POST', `${tablaPath()}/rows`, { index: null, values: [fila] })
    return 'creada'
  }
  const numeroFila = filaInicial + 1 + posicion
  await ejecutar('PATCH', rango(`A${numeroFila}:${ultima}${numeroFila}`), { values: [fila] })
  return 'actualizada'
}
