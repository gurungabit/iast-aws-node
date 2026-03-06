import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { AuthGuard } from '../auth/AuthGuard'
import { ASTProvider } from '../providers/ASTProvider'
import { ASTEventBridge } from '../providers/ASTEventBridge'
import { Navbar } from '../components/Navbar'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <AuthGuard>
      <ASTProvider>
        <div className="flex flex-col h-screen overflow-hidden bg-gray-100 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
          <ASTEventBridge />
          <Navbar />
          <main className="flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </ASTProvider>
    </AuthGuard>
  )
}
