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
  vi.fn().mockImplementation((_key: string, defaultValue: unknown) => [defaultValue, vi.fn()]),
)

const mockUseASTRegistry = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    getAST: vi.fn().mockReturnValue({
      id: 'rout_extractor',
      name: 'RoutExtractor',
      category: 'fire',
      supportsParallel: false,
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

vi.mock('@src/components/ui/Button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('@src/components/ui/Checkbox', () => ({
  Checkbox: ({ label }: { label: string }) => <label>{label}</label>,
}))

vi.mock('@src/components/ui/Input', () => ({
  Input: ({ label, ...props }: { label?: string }) => (
    <div>
      {label && <label>{label}</label>}
      <input {...props} />
    </div>
  ),
}))

vi.mock('@src/components/ui/Toggle', () => ({
  Toggle: ({ label }: { label: string }) => <div>{label}</div>,
}))

vi.mock('@src/ast/rout-extractor/DataInquiryModal', () => ({
  DataInquiryModal: () => null,
}))

vi.mock('@src/services/ast-configs', () => ({
  listAstConfigs: vi.fn().mockResolvedValue([]),
}))

import { RoutExtractorForm } from '@src/ast/rout-extractor/RoutExtractorForm'

describe('RoutExtractorForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing (no props)', () => {
    const { container } = render(<RoutExtractorForm />)
    expect(container).toBeDefined()
  })

  it('renders form wrapper with RoutExtractor title', () => {
    render(<RoutExtractorForm />)
    expect(screen.getByText('RoutExtractor')).toBeDefined()
  })

  it('renders Data Source radio options', () => {
    render(<RoutExtractorForm />)
    expect(screen.getByText('Data Source')).toBeDefined()
    expect(screen.getByText('412 File Import')).toBeDefined()
    expect(screen.getByText('ROUT Screen Scraping')).toBeDefined()
  })

  it('uses useAST hook internally', () => {
    render(<RoutExtractorForm />)
    expect(mockUseAST).toHaveBeenCalled()
  })

  it('uses useAuth hook internally', () => {
    render(<RoutExtractorForm />)
    expect(mockUseAuth).toHaveBeenCalled()
  })
})
