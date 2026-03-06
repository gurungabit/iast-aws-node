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
      id: 'bi_renew',
      name: 'BI Renew',
      category: 'auto',
      supportsParallel: true,
    }),
  }),
)

const mockUseASTStore = vi.hoisted(() => vi.fn().mockReturnValue(null))

vi.mock('../../hooks/useAST', () => ({ useAST: mockUseAST }))
vi.mock('../../auth/useAuth', () => ({ useAuth: mockUseAuth }))
vi.mock('../../hooks/useFormField', () => ({ useFormField: mockUseFormField }))
vi.mock('../registry', () => ({ useASTRegistry: mockUseASTRegistry }))
vi.mock('../../stores/ast-store', () => ({ useASTStore: mockUseASTStore }))

vi.mock('../shared', () => ({
  ASTFormWrapper: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="form-wrapper">
      <div>{title}</div>
      {children}
    </div>
  ),
  CredentialsInput: () => <div data-testid="credentials" />,
}))

vi.mock('../../components/ui/DatePicker', () => ({
  DatePicker: ({ label }: { label: string }) => <div data-testid="date-picker">{label}</div>,
}))

vi.mock('../../services/ast-configs', () => ({
  listAstConfigs: vi.fn().mockResolvedValue([]),
}))

import { BiRenewASTForm } from './BiRenewASTForm'

describe('BiRenewASTForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing (no props)', () => {
    const { container } = render(<BiRenewASTForm />)
    expect(container).toBeDefined()
  })

  it('renders form wrapper with BI Renew title', () => {
    render(<BiRenewASTForm />)
    expect(screen.getByText('BI Renew')).toBeDefined()
  })

  it('renders the date picker for missed run date', () => {
    render(<BiRenewASTForm />)
    expect(screen.getByText('Missed Run Date')).toBeDefined()
  })

  it('uses useAST hook internally', () => {
    render(<BiRenewASTForm />)
    expect(mockUseAST).toHaveBeenCalled()
  })

  it('uses useAuth hook internally', () => {
    render(<BiRenewASTForm />)
    expect(mockUseAuth).toHaveBeenCalled()
  })
})
