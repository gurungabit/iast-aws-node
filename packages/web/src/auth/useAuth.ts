import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { loginRequest } from '../config/auth'

export function useAuth() {
  const { instance, accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()

  const login = async () => {
    await instance.loginPopup(loginRequest)
  }

  const logout = async () => {
    await instance.logoutPopup()
  }

  const user = accounts[0]
    ? {
        name: accounts[0].name || '',
        email: accounts[0].username || '',
      }
    : null

  return { isAuthenticated, user, login, logout }
}
