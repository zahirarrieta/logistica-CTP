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