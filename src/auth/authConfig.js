const CLIENT_ID =
  import.meta.env.VITE_AZURE_CLIENT_ID || '6924d555-d956-4f27-90f8-4d5486a1adb8'
const TENANT_ID =
  import.meta.env.VITE_AZURE_TENANT_ID || '0294e0dd-589f-4476-b787-4e6f5f291e6f'

// ============================================================================
// Alcance de la API
//
// El backend valida el token contra el JWKS del tenant. Exige que la audiencia
// sea esta aplicación, y además acepta la de Microsoft Graph (ver
// server/src/auth.js), porque Graph está firmado por las claves del MISMO
// tenant: prueba la misma identidad de usuario.
//
// Pedir el scope propio `api://<CLIENT_ID>/access_as_user` solo funciona si en
// Entra ID se hizo "Expose an API" > access_as_user. Mientras no exista,
// Microsoft rechaza la petición con AADSTS500011 y el login obliga a hacer dos
// viajes: uno que falla y otro con Graph.
//
// Por eso el scope propio está APAGADO por defecto y se enciende poniendo
// VITE_USAR_SCOPE_API=1, después de publicar el scope en Entra ID. Mientras
// tanto se pide Graph, que da un token que la API valida igual.
// ============================================================================
export const apiScope = import.meta.env.VITE_API_SCOPE || `api://${CLIENT_ID}/access_as_user`

const USAR_SCOPE_API = import.meta.env.VITE_USAR_SCOPE_API === '1'

// Graph aporta lo que la app usa de verdad: leer el perfil para el nombre,
// Files.ReadWrite para OneDrive y Mail.Send para el correo.
const SCOPES_GRAPH = ['openid', 'profile', 'email', 'User.Read', 'Files.ReadWrite']

export const loginRequest = {
  scopes: USAR_SCOPE_API ? [...SCOPES_GRAPH, apiScope] : SCOPES_GRAPH,
}

// Red de seguridad para cuando VITE_USAR_SCOPE_API=1 y el scope aún no está
// publicado. Solo se usa en ese caso; en el flujo normal no interviene.
export const loginRequestRespaldo = {
  scopes: SCOPES_GRAPH,
}

// Microsoft usa varios códigos distintos para decir "ese scope no existe en el
// tenant", y cuál aparece depende de si el fallo se detecta en la redirección
// o al volver de ella:
//
//   AADSTS65001  - la app pidió un scope que no tiene
//   AADSTS500011 - el recurso api://<id> no está registrado en el tenant
//   AADSTS7000213/7000215 - recurso o cliente inválido
//   invalid_scope / unauthorized_client / invalid_resource - variantes de OAuth
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

// El scope con el que hay que pedir token para la API. Lo usan tanto el login
// como la renovación silenciosa, y ambos tienen que coincidir: pedir uno en el
// login y otro al renovar hace que MSAL no encuentre nada en caché.
export function scopeDeApi() {
  return USAR_SCOPE_API ? apiScope : 'User.Read'
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
