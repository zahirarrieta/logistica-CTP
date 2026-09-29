import { PublicClientApplication } from '@azure/msal-browser'
import { msalConfig } from './authConfig.js'

export const msalInstance = new PublicClientApplication(msalConfig)

export function getActiveAccount() {
  return msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0] || null
}

export const msalReady = msalInstance
  .initialize()
  .then(() => {
    // El Redirect URI que realmente se manda a Microsoft es window.location.origin
    // (ver msalConfig). Se imprime porque es el dato que más se ha descartado sin
    // pruebas: si el usuario entra por www, por http o por un puerto distinto,
    // el valor enviado no es el que está registrado y Microsoft lo rechaza.
    console.log(
      `[Auth] redirectUri que se enviará: ${msalConfig.auth.redirectUri} ` +
        `| tenant: ${msalConfig.auth.authority}`
    )
    return msalInstance.handleRedirectPromise()
  })