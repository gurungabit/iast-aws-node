import { type ReactNode, useEffect } from 'react'
import { useAuth } from './useAuth'
import { useTheme } from '../hooks/useTheme'
import { ThemeToggle } from '../components/ThemeToggle'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps): ReactNode {
  const { isAuthenticated, isLoading, login } = useAuth()
  const { theme, toggleTheme } = useTheme()

  // Auto-redirect to MSAL login when not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void login()
    }
  }, [isLoading, isAuthenticated, login])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-zinc-950">
        <div className="absolute top-4 right-4">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gray-300 dark:border-zinc-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-zinc-500">
            {isLoading ? 'Loading...' : 'Redirecting to sign in...'}
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
