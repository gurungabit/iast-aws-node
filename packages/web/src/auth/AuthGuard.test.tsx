import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockUseAuth = vi.hoisted(() => vi.fn())

vi.mock('./useAuth', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark' as const, toggleTheme: vi.fn() }),
}))

vi.mock('../components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}))

import { AuthGuard } from './AuthGuard'

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children in dev mode (no VITE_MSAL_CLIENT_ID)', () => {
    // In test env, VITE_MSAL_CLIENT_ID is not set, so dev mode is active
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
    })
    render(<AuthGuard><div>Child Content</div></AuthGuard>)
    expect(screen.getByText('Child Content')).toBeDefined()
  })

  it('shows loading state when isLoading', () => {
    // Force MSAL mode by stubbing env
    vi.stubEnv('VITE_MSAL_CLIENT_ID', 'test-client-id')
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
    })
    render(<AuthGuard><div>Child</div></AuthGuard>)
    expect(screen.getByText('Loading...')).toBeDefined()
    vi.unstubAllEnvs()
  })

  it('shows redirecting when not authenticated', () => {
    vi.stubEnv('VITE_MSAL_CLIENT_ID', 'test-client-id')
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
    })
    render(<AuthGuard><div>Child</div></AuthGuard>)
    expect(screen.getByText('Redirecting to sign in...')).toBeDefined()
    vi.unstubAllEnvs()
  })

  it('renders children when authenticated in MSAL mode', () => {
    vi.stubEnv('VITE_MSAL_CLIENT_ID', 'test-client-id')
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
    })
    render(<AuthGuard><div>Authenticated Child</div></AuthGuard>)
    expect(screen.getByText('Authenticated Child')).toBeDefined()
    vi.unstubAllEnvs()
  })
})
