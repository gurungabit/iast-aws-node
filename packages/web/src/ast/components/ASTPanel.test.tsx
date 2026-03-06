import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockUseASTStore = vi.hoisted(() => vi.fn())
const mockUseASTRegistry = vi.hoisted(() => vi.fn())
const mockUseFormField = vi.hoisted(() => vi.fn())

vi.mock('../../stores/ast-store', () => ({
  useASTStore: mockUseASTStore,
}))

vi.mock('../registry', () => ({
  useASTRegistry: mockUseASTRegistry,
}))

vi.mock('../../hooks/useFormField', () => ({
  useFormField: mockUseFormField,
}))

vi.mock('../login/register', () => ({}))
vi.mock('../bi-renew/register', () => ({}))
vi.mock('../rout-extractor/register', () => ({}))

vi.mock('./ASTSelector', () => ({
  ASTSelector: ({ value, placeholder }: { value: string | null; placeholder?: string }) => (
    <div data-testid="ast-selector">{value ?? placeholder ?? 'Select Automation'}</div>
  ),
}))

vi.mock('../../components/ui/Card', () => ({
  Card: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="card">
      <div>{title}</div>
      {children}
    </div>
  ),
}))

import { ASTPanel } from './ASTPanel'

describe('ASTPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseASTStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) => {
      const state = {
        activeTabId: 'tab-1',
        tabs: {
          'tab-1': { selectedASTId: null },
        },
        setSelectedASTId: vi.fn(),
      }
      return selector(state)
    })

    mockUseASTRegistry.mockReturnValue({
      getAST: vi.fn().mockReturnValue(undefined),
    })

    mockUseFormField.mockReturnValue(['ast', vi.fn()])
  })

  it('renders without crashing', () => {
    const { container } = render(<ASTPanel />)
    expect(container).toBeDefined()
  })

  it('shows Select Automation label', () => {
    render(<ASTPanel />)
    expect(screen.getByText('Select Automation')).toBeDefined()
  })

  it('shows "No AST Selected" card when no AST selected', () => {
    render(<ASTPanel />)
    expect(screen.getByText('No AST Selected')).toBeDefined()
  })

  it('renders AST component when AST is selected', () => {
    const MockComponent = () => <div>MockForm</div>

    mockUseASTStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) => {
      const state = {
        activeTabId: 'tab-1',
        tabs: {
          'tab-1': { selectedASTId: 'login' },
        },
        setSelectedASTId: vi.fn(),
      }
      return selector(state)
    })

    mockUseASTRegistry.mockReturnValue({
      getAST: vi.fn().mockReturnValue({
        id: 'login',
        name: 'TSO Login',
        component: MockComponent,
      }),
    })

    render(<ASTPanel />)
    expect(screen.getByText('MockForm')).toBeDefined()
  })

  it('shows AST and AutoLauncher mode toggle buttons', () => {
    render(<ASTPanel />)
    expect(screen.getByText('AST')).toBeDefined()
    expect(screen.getByText('AutoLauncher')).toBeDefined()
  })
})
