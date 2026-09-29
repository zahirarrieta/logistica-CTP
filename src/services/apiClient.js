import { msalInstance } from '../auth/msal.js'
import { scopeDeApi } from '../auth/authConfig.js'
import { shortName } from '../auth/user.js'

// ============================================================================
// Cliente HTTP del backend propio (Node.js + MySQL en Latinoamérica Hosting).
// Reemplaza al SDK de Supabase: ya no hay createClient, ni sesión anónima, ni
// claves publishable. Cada petición manda el token de Microsoft en la cabecera
// Authorization y el backend valida la firma, el emisor y la caducidad.
// ============================================================================

// Dominio de la API en el hosting (subdominio de la app Node.js Selector).
// Se puede sobrescribir con VITE_API_URL en .env.local si cambia.
const FALLBACK_API = 'https://api.pedro-ctpmedica.com'

const base = (import.meta.env.VITE_API_URL || FALLBACK_API).trim().replace(/\/+$/, '')

export const API_URL = base
export const backendActivo = true

// Identidad del usuario de Microsoft. La fuente es la misma que antes: la
// cuenta de MSAL. El backend extrae el correo del propio token, así que el
// valor que se mande en el cuerpo es solo para mostrar el nombre.
export function datosUsuario() {
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0]
  const correo = (account?.username || account?.idTokenClaims?.email || '').toLowerCase().trim()
  return { correo, nombre: account?.name?.trim() || shortName(account) }
}

// Devuelve un access token válido para la API, pidiéndole a MSAL uno nuevo si
// el actual está por caducar. El scope es el de la API propia (ver authConfig),
// no el de Graph: un token de Graph lleva otra audiencia y el backend lo
// rechazaría. Antes de Supabase se abría aquí una sesión anónima; ahora se pide
// un token de Microsoft para nuestra propia API.
export async function iniciarSesion() {
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0]
  if (!account) return null
  // Respeta el modo de respaldo: si el scope de la API no está publicado en
  // Entra ID, pedirlo aquí fallaría en cada petición y la app quedaría
  // inutilizable. Con Graph el token también lo acepta el backend.
  const scope = scopeDeApi()
  try {
    const resp = await msalInstance.acquireTokenSilent({ scopes: [scope], account })
    return resp.accessToken
  } catch (error) {
    console.warn('[API] no se pudo renovar el token, redirigiendo:', error?.message)
    msalInstance
      .acquireTokenRedirect({ scopes: [scope], account })
      .catch((e) => console.error('[API] falló la renovación:', e?.message))
    throw new Error('Autorizando con Microsoft… la página se recargará.')
  }
}

// Sin sesión que cerrar en el backend: la de Microsoft se cierra en AuthContext.
// Se mantiene la firma porque AuthContext la llama al hacer logout.
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

// Llamada base: adjunta el token, serializa el cuerpo y normaliza los errores.
export async function apiFetch(ruta, { method = 'GET', body, headers = {}, ...resto } = {}) {
  const token = await iniciarSesion()
  if (!token) throw new ApiError('No hay sesión de Microsoft activa', 401, null)

  const init = {
    method,
    ...resto,
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
  }

  if (body !== undefined && !(body instanceof FormData)) {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  } else if (body !== undefined) {
    init.body = body
  }

  const resp = await fetch(`${base}${ruta}`, init)
  if (resp.status === 204) return null

  const texto = await resp.text()
  let datos = null
  try {
    datos = texto ? JSON.parse(texto) : null
  } catch {
    datos = null
  }

  if (!resp.ok) {
    const mensaje = datos?.error || `Error ${resp.status} del servidor`
    throw new ApiError(mensaje, resp.status, datos)
  }
  return datos
}

// Azúcar para los endpoints que se llaman desde un solo sitio.
export const apiGet = (ruta) => apiFetch(ruta)
export const apiPost = (ruta, body) => apiFetch(ruta, { method: 'POST', body })
export const apiPut = (ruta, body) => apiFetch(ruta, { method: 'PUT', body })
export const apiDelete = (ruta) => apiFetch(ruta, { method: 'DELETE' })
