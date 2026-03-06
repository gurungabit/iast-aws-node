import type { PublicClientApplication } from '@azure/msal-browser'
import { apiScopes } from '../config/auth'

let msalInstance: PublicClientApplication | null = null

export function setMsalInstance(instance: PublicClientApplication) {
  msalInstance = instance
}

export async function getAccessToken(): Promise<string> {
  if (!msalInstance) {
    // Dev mode - no MSAL
    return 'dev-token'
  }

  const accounts = msalInstance.getAllAccounts()
  if (accounts.length === 0) throw new Error('No accounts found')

  try {
    const response = await msalInstance.acquireTokenSilent({
      scopes: apiScopes.accessAsUser,
      account: accounts[0],
    })
    return response.accessToken
  } catch {
    const response = await msalInstance.acquireTokenPopup({
      scopes: apiScopes.accessAsUser,
    })
    return response.accessToken
  }
}
