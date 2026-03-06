import { useCallback, useMemo } from 'react'
import { useMsal } from '@azure/msal-react'
import { InteractionStatus, InteractionRequiredAuthError } from '@azure/msal-browser'
import { loginRequest } from '../config/auth'

export interface UserInfo {
  id: string
  name: string
  email: string
}

export interface UseAuthReturn {
  isAuthenticated: boolean
  isLoading: boolean
  user: UserInfo | null
  getAccessToken: () => Promise<string | null>
  login: () => Promise<void>
  logout: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const { instance, accounts, inProgress } = useMsal()

  const account = accounts[0]
  const isAuthenticated = !!account
  const isLoading = inProgress !== InteractionStatus.None

  const user = useMemo<UserInfo | null>(() => {
    if (!account) return null
    return {
      id: account.localAccountId,
      name: account.name || '',
      email: account.username || '',
    }
  }, [account])

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!account || inProgress !== InteractionStatus.None) return null

    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account,
      })
      return response.accessToken
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        try {
          await instance.acquireTokenRedirect({ ...loginRequest, account })
        } catch {
          // redirect failed
        }
      }
      return null
    }
  }, [account, instance, inProgress])

  const login = useCallback(async () => {
    if (inProgress !== InteractionStatus.None) return

    try {
      // Try silent SSO first (picks up existing Azure session)
      await instance.ssoSilent(loginRequest)
    } catch {
      // No existing session — fall back to redirect
      try {
        await instance.loginRedirect(loginRequest)
      } catch (error) {
        console.error('Login failed:', error)
      }
    }
  }, [instance, inProgress])

  const logout = useCallback(async () => {
    try {
      await instance.logoutRedirect({
        account,
        postLogoutRedirectUri: window.location.origin,
      })
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }, [instance, account])

  return { isAuthenticated, isLoading, user, getAccessToken, login, logout }
}
