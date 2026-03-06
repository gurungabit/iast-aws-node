import type { PublicClientApplication } from '@azure/msal-browser'
import { loginRequest } from '../config/auth'

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
      ...loginRequest,
      account: accounts[0],
    })
    return response.accessToken
  } catch {
    await msalInstance.acquireTokenRedirect({
      ...loginRequest,
      account: accounts[0],
    })
    // Will redirect — this line won't be reached
    throw new Error('Redirecting for authentication')
  }
}
