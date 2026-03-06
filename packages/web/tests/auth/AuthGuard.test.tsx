import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockUseAuth = vi.hoisted(() => vi.fn())

vi.mock('@src/auth/useAuth', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('@src/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark' as const, toggleTheme: vi.fn() }),
}))

vi.mock('@src/components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}))

import { AuthGuard } from '@src/auth/AuthGuard'

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state when isLoading', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
    })
    render(<AuthGuard><div>Child</div></AuthGuard>)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('shows redirecting when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
    })
    render(<AuthGuard><div>Child</div></AuthGuard>)
    expect(screen.getByText('Redirecting to sign in...')).toBeDefined()
  })

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
    })
    render(<AuthGuard><div>Authenticated Child</div></AuthGuard>)
    expect(screen.getByText('Authenticated Child')).toBeDefined()
  })

  it('calls login when not authenticated and not loading', () => {
    const login = vi.fn()
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login,
    })
    render(<AuthGuard><div>Child</div></AuthGuard>)
    expect(login).toHaveBeenCalled()
  })
})
