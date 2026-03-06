import { useState, useEffect, useCallback, useMemo } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
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

// Dev mode stub when MSAL is not configured
const devAuth: UseAuthReturn = {
  isAuthenticated: true,
  isLoading: false,
  user: { id: 'dev-user', name: 'Dev User', email: 'dev@local' },
  getAccessToken: async () => null,
  login: async () => {},
  logout: async () => {},
}

export function useAuth(): UseAuthReturn {
  // Dev mode bypass
  if (!import.meta.env.VITE_MSAL_CLIENT_ID) {
    return devAuth
  }

  return useMsalAuth()
}

function useMsalAuth(): UseAuthReturn {
  const { instance, accounts, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [isLoading, setIsLoading] = useState(true)

  const account = accounts[0]

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
    try {
      await instance.loginRedirect(loginRequest)
    } catch (error) {
      console.error('Login failed:', error)
    }
  }, [instance])

  const logout = useCallback(async () => {
    try {
      await instance.logoutRedirect({ account })
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }, [instance, account])

  useEffect(() => {
    if (inProgress === InteractionStatus.None) {
      setIsLoading(false)
    }
  }, [inProgress])

  return { isAuthenticated, isLoading, user, getAccessToken, login, logout }
}
