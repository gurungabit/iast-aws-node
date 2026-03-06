import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from './config/auth'
import { setMsalInstance } from './auth/token'
import { routeTree } from './routeTree.gen'
import './index.css'

const queryClient = new QueryClient()

const router = createRouter({
  routeTree,
  context: { queryClient },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Initialize MSAL only if configured
const msalClientId = import.meta.env.VITE_MSAL_CLIENT_ID
let msalInstance: PublicClientApplication | null = null

if (msalClientId) {
  msalInstance = new PublicClientApplication(msalConfig)
  setMsalInstance(msalInstance)
}

export function App() {
  const core = (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )

  if (msalInstance) {
    return <MsalProvider instance={msalInstance}>{core}</MsalProvider>
  }

  return core
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
