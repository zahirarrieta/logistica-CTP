import { getActiveAccount, tokenSesion, limpiarSesionCaducada } from '../auth/sesion.js'
import { shortName } from '../auth/user.js'

// ============================================================================
// Cliente HTTP del backend propio (Node.js + MySQL en Latinoamérica Hosting).
// Reemplaza al SDK de Supabase: ya no hay createClient, ni sesión anónima, ni
// claves publishable. Cada petición manda el token de sesión en la cabecera
// Authorization y el backend verifica la firma, el emisor y la caducidad.
// ============================================================================

// Dominio de la API en el hosting (subdominio de la app Node.js Selector).
// Se puede sobrescribir con VITE_API_URL en .env.local si cambia.
const FALLBACK_API = 'https://api.pedro-ctpmedica.com'

// En desarrollo se puede dejar VITE_API_URL VACÍO a propósito (ver
// .env.development.local) para que las peticiones salgan relativas (/api/...) y
// las reenvíe el proxy del Vite dev server a la API real. Así el navegador ve el
// mismo origen (localhost) y no hay bloqueo por CORS. Si la variable NO está
// definida, se usa el dominio absoluto: es lo que hace el build de producción.
const envApi = import.meta.env.VITE_API_URL
const base = (envApi === undefined ? FALLBACK_API : envApi).trim().replace(/\/+$/, '')

export const API_URL = base
export const backendActivo = true

// Identidad del usuario con sesión iniciada. La fuente es la cuenta guardada en
// el navegador; el backend extrae el correo del propio token, así que el valor
// que se mande en el cuerpo es solo para mostrar el nombre.
export function datosUsuario() {
  const account = getActiveAccount()
  const correo = (account?.username || '').toLowerCase().trim()
  return { correo, nombre: account?.name?.trim() || (correo ? shortName(account) : '') }
}

// Devuelve el token de sesión para la API, o '' si no hay sesión.
//
// Antes de Microsoft esto pedía un access token nuevo cada vez que el anterior se
// acercaba a caducar, y si el token guardado se corrompía había que ir a Microsoft
// a por otro. El token propio es un JWT con caducidad fija: cuando caduca, el
// backend responde 401 y apiFetch limpia la sesión y avisa, en vez de intentar
// renovarlo.
export async function iniciarSesion() {
  return tokenSesion()
}

// Sin sesión que revocar en el backend: el token es autocontenido y no se guarda
// en el servidor. Se mantiene la firma porque AuthContext la llama al hacer
// logout.
export function cerrarSesion() {
  return Promise.resolve()
}

export class ApiError extends Error {
  constructor(mensaje, estado, cuerpo) {
    super(mensaje)
    this.name = 'ApiError'
    this.estado = estado
    this.cuerpo = cuerpo
  }

  // El frontend ya trataba el 42501 de RLS como «permiso denegado, no
  // reintentar». Un 403 del backend significa exactamente lo mismo.
  get esPermiso() {
    return this.estado === 403
  }
}

// Construye la petición colocando el token en la cabecera o, como respaldo, en
// el cuerpo. Los WAF/proxis del hosting reescriben cabeceras pero no cuerpos,
// así que mandar el token en el JSON es la vía que esquiva esa alteración.
function preparar(method, body, headers, resto, token, via) {
  const init = { method, ...resto, headers: { ...headers } }
  if (via === 'cabecera') init.headers.Authorization = `Bearer ${token}`

  if (body instanceof FormData) {
    if (via === 'cuerpo') body.set('token', token)
    init.body = body
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(via === 'cuerpo' ? { ...body, token } : body)
  } else if (via === 'cuerpo') {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify({ token })
  }
  return init
}

// Llamada base: adjunta el token, serializa el cuerpo y normaliza los errores.
//
// El reintento por token corrupto que había aquí con Microsoft ya no hace falta:
// nuestro token lo firma el servidor, y el 401 que devuelve tiene un motivo
// concreto. Lo que sí se conserva es el reintento por el cuerpo, que no depende
// de quién firmó el token sino de que la cabecera llegue intacta.
export async function apiFetch(ruta, { method = 'GET', body, headers = {}, ...resto } = {}) {
  const token = await iniciarSesion()
  if (!token) throw new ApiError('No hay sesión activa', 401, null)

  let via = 'cabecera'
  const enviar = () => fetch(`${base}${ruta}`, preparar(method, body, headers, resto, token, via))

  let resp = await enviar()

  // Un 401 con token presente solo puede significar que caducó (pasó SESSION_TTL),
  // que el servidor se reinició con otro SESSION_SECRET, o que un proxy del
  // hosting está reescribiendo la cabecera Authorization. Se reintenta UNA vez por
  // el cuerpo, que los WAF no tocan; si vuelve a fallar, se limpia la sesión.
  if (resp.status === 401 && via === 'cabecera') {
    via = 'cuerpo'
    resp = await enviar()
  }

  if (resp.status === 204) return null

  const texto = await resp.text()
  let datos = null
  try {
    datos = texto ? JSON.parse(texto) : null
  } catch {
    datos = null
  }

  if (resp.ok) return datos

  if (resp.status === 401) {
    limpiarSesionCaducada()
    // AuthContext escucha este evento y manda al login. Si el error lo viera solo
    // el componente que hizo la petición, aparecería en un toast suelto donde
    // nadie lo asocia con «hay que volver a entrar».
    window.dispatchEvent(new CustomEvent('ctp:sesion-caducada'))
  }

  const mensaje = datos?.error || `Error ${resp.status} del servidor`
  throw new ApiError(mensaje, resp.status, datos)
}

// Azúcar para los endpoints que se llaman desde un solo sitio.
export const apiGet = (ruta) => apiFetch(ruta)
export const apiPost = (ruta, body) => apiFetch(ruta, { method: 'POST', body })
export const apiPut = (ruta, body) => apiFetch(ruta, { method: 'PUT', body })
export const apiDelete = (ruta) => apiFetch(ruta, { method: 'DELETE' })
