import { PublicClientApplication } from '@azure/msal-browser'
import { msalConfig } from './authConfig.js'

export const msalInstance = new PublicClientApplication(msalConfig)

export function getActiveAccount() {
  return msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0] || null
}

export const msalReady = msalInstance
  .initialize()
  .then(() => msalInstance.handleRedirectPromise())