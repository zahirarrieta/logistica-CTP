const CLIENT_ID =
  import.meta.env.VITE_AZURE_CLIENT_ID || '6924d555-d956-4f27-90f8-4d5486a1adb8'
const TENANT_ID =
  import.meta.env.VITE_AZURE_TENANT_ID || '0294e0dd-589f-4476-b787-4e6f5f291e6f'

export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
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