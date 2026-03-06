import { type ReactNode } from 'react'
import { MsalAuthenticationTemplate, UnauthenticatedTemplate } from '@azure/msal-react'
import { InteractionType } from '@azure/msal-browser'
import { loginRequest } from '../config/auth'

interface AuthGuardProps {
  children: ReactNode
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">IAST</h1>
        <p className="mt-2 text-gray-400">Authenticating...</p>
      </div>
    </div>
  )
}

export function AuthGuard({ children }: AuthGuardProps) {
  // Dev mode: skip auth if MSAL not configured
  if (!import.meta.env.VITE_MSAL_CLIENT_ID) {
    return <>{children}</>
  }

  return (
    <>
      <MsalAuthenticationTemplate
        interactionType={InteractionType.Popup}
        authenticationRequest={loginRequest}
        loadingComponent={LoginFallback}
      >
        {children}
      </MsalAuthenticationTemplate>
      <UnauthenticatedTemplate>
        <LoginFallback />
      </UnauthenticatedTemplate>
    </>
  )
}
