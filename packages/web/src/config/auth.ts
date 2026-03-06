import { type Configuration, LogLevel } from '@azure/msal-browser'

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
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return
        switch (level) {
          case LogLevel.Error:
            console.error(message)
            break
          case LogLevel.Warning:
            console.warn(message)
            break
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
}

export const loginRequest = {
  scopes: [import.meta.env.VITE_MSAL_API_SCOPE || 'User.Read'],
}

export const apiScopes = {
  accessAsUser: [import.meta.env.VITE_MSAL_API_SCOPE || 'User.Read'],
}
