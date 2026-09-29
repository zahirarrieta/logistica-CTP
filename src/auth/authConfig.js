const CLIENT_ID =
  import.meta.env.VITE_AZURE_CLIENT_ID || '6924d555-d956-4f27-90f8-4d5486a1adb8'
const TENANT_ID =
  import.meta.env.VITE_AZURE_TENANT_ID || '0294e0dd-589f-4476-b787-4e6f5f291e6f'

// ============================================================================
// Scope de la API propia.
// El backend valida el token contra el JWKS del tenant y exige que la audiencia
// sea esta aplicación. Un token de Microsoft Graph (aud 00000003-0000-...) NO
// sirve para eso, así que hay que pedir explícitamente el scope de la API.
//
// Requisito en Entra ID > App registrations > esta app > Expose an API:
//   Application ID URI: api://<CLIENT_ID>
//   scope: access_as_user  ( consented by admins)
// Si el scope aún no existe, el backend acepta también la audiencia de Graph
// (ver server/src/auth.js), de modo que la app funciona igual mientras tanto.
// ============================================================================
export const apiScope = import.meta.env.VITE_API_SCOPE || `api://${CLIENT_ID}/access_as_user`

// El login pide el scope de la API para que MSAL lo guarde en caché y
// posteriormente se pueda obtener en silencio.
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read', 'Files.ReadWrite', apiScope],
}

// Respaldo: los mismos permisos pero SIN el scope de la API propia.
//
// Hace falta porque ese scope solo existe si en Entra ID se hizo "Expose an API"
// > access_as_user. Si no se publicó, Microsoft rechaza la petición con
// AADSTS65001 y el botón de login se queda sin hacer nada visible. Como el
// backend también acepta la audiencia de Microsoft Graph (ver server/src/auth.js),
// entrar por Graph da un token que la API sí valida, y la app funciona igual.
//
// La bandera se guarda en sessionStorage para que, tras un primer login fallido,
// los intentos siguientes tampoco usen el scope inexistente.
const CLAVE_RESPALDO = 'ctp:login-respaldo'

export function usarRespaldo() {
  return sessionStorage.getItem(CLAVE_RESPALDO) === '1'
}

export function activarRespaldo() {
  sessionStorage.setItem(CLAVE_RESPALDO, '1')
}

export function desactivarRespaldo() {
  sessionStorage.removeItem(CLAVE_RESPALDO)
}

export const loginRequestRespaldo = {
  scopes: ['openid', 'profile', 'email', 'User.Read', 'Files.ReadWrite'],
}

// Devuelve el scope con el que hay que pedir token para la API, respetando el
// modo de respaldo. Lo usan tanto el login como la renovación silenciosa.
export function scopeDeApi() {
  return usarRespaldo() ? 'User.Read' : apiScope
}

// Microsoft usa varios códigos distintos para decir "ese scope no existe en el
// tenant", y cuál aparece depende de si el fallo se detecta en la redirección
// o al volver de ella:
//
//   AADSTS65001  - la app pidió un scope que no tiene
//   AADSTS500011 - el recurso api://<id> no está registrado en el tenant
//   AADSTS7000213/7000215 - recurso o cliente inválido
//   invalid_scope / unauthorized_client - variantes de OAuth
//
// Que la lista viviera en un solo sitio es lo que evita que un código nuevo
// vuelva a dejar el login colgado: antes AADSTS500011 no coincidía con el
// patrón y el respaldo nunca se activaba.
export function esErrorDeScope(texto) {
  const crudo = String(texto || '')
  return (
    /AADSTS65001/i.test(crudo) ||
    /AADSTS500011/i.test(crudo) ||
    /AADSTS700021[35]/i.test(crudo) ||
    /invalid_scope|unauthorized_client|invalid_resource/i.test(crudo)
  )
}

// OneDrive y el correo siguen siendo recursos de Graph, con su propio token.
export const graphTokenRequest = {
  scopes: ['Files.ReadWrite', 'Mail.Send'],
}

export const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
}