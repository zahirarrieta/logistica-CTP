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
//
// `forzar` omite la caché de MSAL: si el token guardado en el navegador se
// corrompió (escritura truncada con el almacenamiento lleno, p. ej.), el silent
// devolvería esa copia mala una y otra vez y la firma nunca verificaría.
export async function iniciarSesion(forzar = false) {
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0]
  if (!account) return null
  // Respeta el modo de respaldo: si el scope de la API no está publicado en
  // Entra ID, pedirlo aquí fallaría en cada petición y la app quedaría
  // inutilizable. Con Graph el token también lo acepta el backend.
  const scope = scopeDeApi()
  try {
    const resp = await msalInstance.acquireTokenSilent({ scopes: [scope], account, forceRefresh: forzar })
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

// Huella SHA-256 del token tal como sale del navegador.
//
// El backend devuelve la huella de lo que recibió (`recibido.shaToken`). Si las
// dos difieren, un intermediario del hosting alteró el token en tránsito y por
// eso nunca verifica la firma: es la única forma de distinguir "el token llegó
// mal" de "el servidor verifica mal", que producen exactamente el mismo 401.
async function sha256Local(texto) {
  try {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return ''
  }
}

// Verifica la firma del token EN EL NAVEGADOR, con las claves públicas que
// Microsoft publica (el JWKS admite CORS) y WebCrypto.
//
// Cierra el diagnóstico que faltaba: con la huella ya se sabe si el token llegó
// intacto al servidor, pero eso no dice de quién es la culpa cuando la firma no
// pasa. Si aquí verifica y en el servidor no, las claves o la verificación del
// hosting son el problema. Si aquí tampoco verifica, el token que devolvió el
// propio login de Microsoft ya no es válido, y no hay reintento que lo arregle.
async function verificarFirmaLocal(token) {
  try {
    const [cabeceraB64, cuerpoB64, firmaB64] = token.split('.')
    if (!cabeceraB64 || !cuerpoB64 || !firmaB64) return { ok: false, detalle: 'el token no tiene 3 partes' }

    const aBytes = (b64url) => {
      const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
      const binario = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='))
      const bytes = new Uint8Array(binario.length)
      for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
      return bytes
    }

    const cabecera = JSON.parse(new TextDecoder().decode(aBytes(cabeceraB64)))
    const cuerpo = JSON.parse(new TextDecoder().decode(aBytes(cuerpoB64)))

    // El tenant se lee del emisor del propio token, que es la fuente cierta: de
    // ahí salen las claves que lo firmaron. Es el mismo dato con el que el
    // backend construye sus URLs de descubrimiento, así que ambos miran el
    // mismo JWKS y la comparación tiene sentido.
    const iss = String(cuerpo.iss || '')
    const tenant = iss.split('/').filter(Boolean).pop()
    if (!tenant) return { ok: false, detalle: 'el token no trae emisor' }

    const respuesta = await fetch(`https://login.microsoftonline.com/${tenant}/discovery/keys`, {
      headers: { accept: 'application/json' },
    })
    if (!respuesta.ok) return { ok: false, detalle: `JWKS http ${respuesta.status}` }
    const { keys = [] } = await respuesta.json()

    const clave = keys.find((k) => k.kid === cabecera.kid)
    if (!clave) {
      return { ok: false, detalle: `kid ${cabecera.kid} no está en el JWKS (${keys.length} claves)` }
    }

    const importada = await crypto.subtle.importKey(
      'jwk',
      { kty: clave.kty, n: clave.n, e: clave.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    )
    const datos = new TextEncoder().encode(`${cabeceraB64}.${cuerpoB64}`)
    const ok = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, importada, aBytes(firmaB64), datos)
    return {
      ok,
      detalle: ok ? 'firma correcta en el navegador' : 'la firma NO verifica ni en el navegador',
    }
  } catch (error) {
    return { ok: false, detalle: `no se pudo comprobar aquí: ${error?.message || error}` }
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
// Si el backend rechaza la firma del token (ERR_JWS_SIGNATURE_VERIFICATION_FAILED)
// se reintenta UNA vez con un token pedido de cero a Microsoft: cubre el caso en
// que la copia guardada por MSAL en el navegador esté corrupta, que otherwise
// dejaría la app inutilizable hasta borrar el almacenamiento del sitio.
//
// Si además la huella que reporta el servidor no coincide con la local, el
// token se está alterando en el camino y se reintenta llevándolo en el cuerpo.
export async function apiFetch(ruta, { method = 'GET', body, headers = {}, ...resto } = {}) {
  let forzar = false
  let via = 'cabecera'

  for (;;) {
    const token = await iniciarSesion(forzar)
    if (!token) throw new ApiError('No hay sesión de Microsoft activa', 401, null)

    const resp = await fetch(`${base}${ruta}`, preparar(method, body, headers, resto, token, via))
    if (resp.status === 204) return null

    const texto = await resp.text()
    let datos = null
    try {
      datos = texto ? JSON.parse(texto) : null
    } catch {
      datos = null
    }

    if (resp.ok) return datos

    const firmaRota =
      resp.status === 401 && String(datos?.error || '').includes('ERR_JWS_SIGNATURE_VERIFICATION_FAILED')

    if (firmaRota) {
      const shaLocal = await sha256Local(token)
      const llegada = datos?.recibido || null
      const shaServidor = String(llegada?.shaToken || '')

      if (!shaServidor) {
        // El backend aún es anterior a la sonda de integridad: no hay con qué
        // comparar, así que se hace lo único que queda, pedir un token nuevo.
        if (!forzar) {
          console.warn('[API] el token no verifica la firma: pidiendo uno nuevo a Microsoft y reintentando')
          forzar = true
          continue
        }
      } else if (shaServidor !== shaLocal) {
        console.warn(
          `[API] el token llegó ALTERADO al servidor (local ${shaLocal.slice(0, 12)}… ≠ recibido ${shaServidor.slice(0, 12)}…) ` +
            `largo=${llegada?.largo} caracteres=${JSON.stringify(llegada?.caracteres)}; reintentando con el token en el cuerpo`
        )
        if (via === 'cabecera') {
          via = 'cuerpo'
          continue
        }
      } else {
        // Íntegro en tránsito: la culpa es del token o de la verificación del
        // servidor. Comprobar la firma aquí, con las claves de Microsoft, separa
        // las dos sin que nadie tenga que abrir los logs del hosting.
        const local = await verificarFirmaLocal(token)
        console.warn(
          `[API] el token llegó INTACTO al servidor (sha ${shaLocal.slice(0, 12)}…, largo ${token.length}) y aun así no verifica. ` +
            `Comprobación en el navegador: ${local.detalle}`
        )
        if (local.ok) {
          console.warn('[API] la firma es buena: el problema lo tiene la verificación del servidor (sus claves o su JWKS).')
        } else if (!forzar) {
          console.warn('[API] el token ya venía inválido desde Microsoft: pidiendo uno nuevo y reintentando.')
          forzar = true
          continue
        }
      }
    }

    const mensaje = datos?.error || `Error ${resp.status} del servidor`
    throw new ApiError(mensaje, resp.status, datos)
  }
}

// Azúcar para los endpoints que se llaman desde un solo sitio.
export const apiGet = (ruta) => apiFetch(ruta)
export const apiPost = (ruta, body) => apiFetch(ruta, { method: 'POST', body })
export const apiPut = (ruta, body) => apiFetch(ruta, { method: 'PUT', body })
export const apiDelete = (ruta) => apiFetch(ruta, { method: 'DELETE' })
