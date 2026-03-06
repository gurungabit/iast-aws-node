import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockExecuteAST = vi.hoisted(() => vi.fn())

const mockUseAST = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    status: 'idle',
    isRunning: false,
    lastResult: null,
    progress: null,
    itemResults: [],
    statusMessages: [],
    executeAST: mockExecuteAST,
    controlAST: vi.fn(),
    clearLogs: vi.fn(),
  }),
)

const mockUseAuth = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    isAuthenticated: true,
    user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
    getAccessToken: vi.fn(),
  }),
)

const mockUseFormField = vi.hoisted(() =>
  vi.fn().mockReturnValue(['', vi.fn()]),
)

const mockUseASTRegistry = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    getAST: vi.fn().mockReturnValue({
      id: 'login',
      name: 'TSO Login',
      category: 'fire',
      supportsParallel: true,
    }),
  }),
)

const mockUseASTStore = vi.hoisted(() => vi.fn().mockReturnValue(null))

vi.mock('@src/hooks/useAST', () => ({ useAST: mockUseAST }))
vi.mock('@src/auth/useAuth', () => ({ useAuth: mockUseAuth }))
vi.mock('@src/hooks/useFormField', () => ({ useFormField: mockUseFormField }))
vi.mock('@src/ast/registry', () => ({ useASTRegistry: mockUseASTRegistry }))
vi.mock('@src/stores/ast-store', () => ({ useASTStore: mockUseASTStore }))

vi.mock('@src/ast/shared', () => ({
  ASTFormWrapper: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="form-wrapper">
      <div>{title}</div>
      {children}
    </div>
  ),
  CredentialsInput: () => <div data-testid="credentials" />,
}))

vi.mock('@src/services/ast-configs', () => ({
  listAstConfigs: vi.fn().mockResolvedValue([]),
}))

import { LoginASTForm } from '@src/ast/login/LoginASTForm'

describe('LoginASTForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing (no props)', () => {
    const { container } = render(<LoginASTForm />)
    expect(container).toBeDefined()
  })

  it('renders form wrapper with TSO Login title', () => {
    render(<LoginASTForm />)
    expect(screen.getByText('TSO Login')).toBeDefined()
  })

  it('renders the policy numbers textarea', () => {
    render(<LoginASTForm />)
    expect(
      screen.getByPlaceholderText('Enter 9-char policy numbers (comma, space, or newline separated)'),
    ).toBeDefined()
  })

  it('uses useAST hook internally', () => {
    render(<LoginASTForm />)
    expect(mockUseAST).toHaveBeenCalled()
  })

  it('uses useAuth hook internally', () => {
    render(<LoginASTForm />)
    expect(mockUseAuth).toHaveBeenCalled()
  })

  it('uses useASTRegistry hook internally', () => {
    render(<LoginASTForm />)
    expect(mockUseASTRegistry).toHaveBeenCalled()
  })
})
