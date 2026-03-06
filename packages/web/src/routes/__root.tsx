import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { AuthGuard } from '../auth/AuthGuard'
import { ASTProvider } from '../providers/ASTProvider'
import { Navbar } from '../components/Navbar'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <AuthGuard>
      <ASTProvider>
        <div className="flex h-screen flex-col bg-gray-950 text-white">
          <Navbar />
          <main className="flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </ASTProvider>
    </AuthGuard>
  ),
})
