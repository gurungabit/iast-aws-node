import type { Configuration, PopupRequest } from '@azure/msal-browser'

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MSAL_TENANT_ID || 'common'}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
}

export const loginRequest: PopupRequest = {
  scopes: [import.meta.env.VITE_MSAL_API_SCOPE || 'User.Read'],
}

export const apiScopes = {
  accessAsUser: [import.meta.env.VITE_MSAL_API_SCOPE || 'User.Read'],
}
