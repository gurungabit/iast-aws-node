import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockGetAST = vi.hoisted(() => vi.fn())
const mockGetAllASTs = vi.hoisted(() => vi.fn().mockReturnValue([]))
const mockUseAST = vi.hoisted(() => vi.fn())
const mockClearExecution = vi.hoisted(() => vi.fn())
const mockUseASTStore = vi.hoisted(() =>
  Object.assign(vi.fn().mockReturnValue(mockClearExecution), {
    getState: vi.fn().mockReturnValue({ executions: new Map() }),
  }),
)

const mockVirtualItems = vi.hoisted(() => ({ items: [] as { index: number; key: string; size: number; start: number }[] }))

vi.mock('../registry', () => ({
  getAST: mockGetAST,
  getAllASTs: mockGetAllASTs,
}))

vi.mock('../../hooks/useAST', () => ({
  useAST: mockUseAST,
}))

vi.mock('../../stores/ast-store', () => ({
  useASTStore: mockUseASTStore,
}))

vi.mock('../login/register', () => ({}))
vi.mock('../bi-renew/register', () => ({}))
vi.mock('../rout-extractor/register', () => ({}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; getScrollElement: () => HTMLElement | null; estimateSize: () => number; overscan?: number }) => {
    // Exercise getScrollElement and estimateSize
    opts.getScrollElement?.()
    opts.estimateSize?.()
    return {
      getVirtualItems: () => mockVirtualItems.items,
      getTotalSize: () => mockVirtualItems.items.length * 28,
    }
  },
}))

import { ASTPanel } from './ASTPanel'

describe('ASTPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAST.mockReturnValue({
      runAST: vi.fn(),
      controlAST: vi.fn(),
      execution: null,
    })
    mockGetAST.mockReturnValue(undefined)
    mockGetAllASTs.mockReturnValue([])
  })

  it('renders without crashing', () => {
    const { container } = render(<ASTPanel sessionId="s1" />)
    expect(container).toBeDefined()
  })

  it('shows Select Automation label when AST mode is active', () => {
    mockGetAST.mockReturnValue(undefined)
    render(<ASTPanel sessionId="s1" />)
    expect(screen.getByText('Select Automation')).toBeDefined()
  })

  it('renders AST form when AST is selected', () => {
    mockGetAST.mockReturnValue({
      name: 'login',
      label: 'Login',
      FormComponent: ({ onRun }: { onRun: (params: Record<string, unknown>) => void }) => <button onClick={() => onRun({})}>MockForm</button>,
    })
    render(<ASTPanel sessionId="s1" />)
    expect(screen.getByText('MockForm')).toBeDefined()
  })

  it('shows execution view when execution is active', () => {
    mockUseAST.mockReturnValue({
      runAST: vi.fn(),
      controlAST: vi.fn(),
      execution: {
        status: 'running',
        progress: { current: 5, total: 10, message: 'Processing...' },
        items: [],
        error: null,
      },
    })
    mockGetAST.mockReturnValue({
      name: 'login',
      label: 'Login',
      FormComponent: () => <div>Form</div>,
    })
    render(<ASTPanel sessionId="s1" />)
    expect(screen.getByText('Processing...')).toBeDefined()
  })

  it('shows pause/cancel buttons when running', () => {
    mockUseAST.mockReturnValue({
      runAST: vi.fn(),
      controlAST: vi.fn(),
      execution: {
        status: 'running',
        progress: { current: 2, total: 5, message: 'Running...' },
        items: [],
        error: null,
      },
    })
    mockGetAST.mockReturnValue({
      name: 'login',
      label: 'Login',
      FormComponent: () => <div>Form</div>,
    })
    render(<ASTPanel sessionId="s1" />)
    expect(screen.getByText('Pause')).toBeDefined()
    expect(screen.getByText('Cancel')).toBeDefined()
  })

  it('shows Resume button when paused', () => {
    mockUseAST.mockReturnValue({
      runAST: vi.fn(),
      controlAST: vi.fn(),
      execution: {
        status: 'paused',
        progress: { current: 2, total: 5, message: 'Paused' },
        items: [],
        error: null,
      },
    })
    mockGetAST.mockReturnValue({
      name: 'login',
      label: 'Login',
      FormComponent: () => <div>Form</div>,
    })
    render(<ASTPanel sessionId="s1" />)
    expect(screen.getByText('Resume')).toBeDefined()
  })

  it('shows Clear button when completed', () => {
    mockUseASTStore.mockReturnValue(vi.fn())
    mockUseAST.mockReturnValue({
      runAST: vi.fn(),
      controlAST: vi.fn(),
      execution: {
        status: 'completed',
        progress: { current: 5, total: 5, message: 'Done' },
        items: [],
        error: null,
      },
    })
    mockGetAST.mockReturnValue({
      name: 'login',
      label: 'Login',
      FormComponent: () => <div>Form</div>,
    })
    render(<ASTPanel sessionId="s1" />)
    expect(screen.getByText('Clear')).toBeDefined()
  })

  it('shows error message when execution has error', () => {
    mockUseAST.mockReturnValue({
      runAST: vi.fn(),
      controlAST: vi.fn(),
      execution: {
        status: 'failed',
        progress: { current: 3, total: 5, message: 'Failed' },
        items: [],
        error: 'Connection refused',
      },
    })
    mockGetAST.mockReturnValue({
      name: 'login',
      label: 'Login',
      FormComponent: () => <div>Form</div>,
    })
    render(<ASTPanel sessionId="s1" />)
    expect(screen.getByText('Connection refused')).toBeDefined()
  })

  it('shows items count in execution view', () => {
    mockUseAST.mockReturnValue({
      runAST: vi.fn(),
      controlAST: vi.fn(),
      execution: {
        status: 'completed',
        progress: { current: 3, total: 3, message: 'Complete' },
        items: [
          { policyNumber: 'ABC', status: 'success', durationMs: 100 },
          { policyNumber: 'DEF', status: 'error', durationMs: 200 },
        ],
        error: null,
      },
    })
    mockGetAST.mockReturnValue({
      name: 'login',
      label: 'Login',
      FormComponent: () => <div>Form</div>,
    })
    render(<ASTPanel sessionId="s1" />)
    expect(screen.getByText('2 results')).toBeDefined()
  })

  it('calls runAST with correct params when form onRun is triggered', () => {
    const mockRunAST = vi.fn()
    mockUseAST.mockReturnValue({
      runAST: mockRunAST,
      controlAST: vi.fn(),
      execution: null,
    })
    mockGetAST.mockReturnValue({
      name: 'login',
      label: 'Login',
      FormComponent: ({ onRun }: { onRun: (params: Record<string, unknown>) => void }) => <button onClick={() => onRun({ user: 'test' })}>RunForm</button>,
    })
    render(<ASTPanel sessionId="s1" />)
    fireEvent.click(screen.getByText('RunForm'))
    expect(mockRunAST).toHaveBeenCalledWith('login', { user: 'test' })
  })

  it('calls controlAST when Pause is clicked', () => {
    const mockControlAST = vi.fn()
    mockUseAST.mockReturnValue({
      runAST: vi.fn(),
      controlAST: mockControlAST,
      execution: {
        status: 'running',
        progress: { current: 1, total: 5, message: 'Running' },
        items: [],
        error: null,
      },
    })
    mockGetAST.mockReturnValue({
      name: 'login',
      label: 'Login',
      FormComponent: () => <div>Form</div>,
    })
    render(<ASTPanel sessionId="s1" />)
    fireEvent.click(screen.getByText('Pause'))
    expect(mockControlAST).toHaveBeenCalledWith('pause')
  })

  it('calls controlAST resume when Resume is clicked', () => {
    const mockControlAST = vi.fn()
    mockUseAST.mockReturnValue({
      runAST: vi.fn(),
      controlAST: mockControlAST,
      execution: {
        status: 'paused',
        progress: { current: 1, total: 5, message: 'Paused' },
        items: [],
        error: null,
      },
    })
    mockGetAST.mockReturnValue({
      name: 'login',
      label: 'Login',
      FormComponent: () => <div>Form</div>,
    })
    render(<ASTPanel sessionId="s1" />)
    fireEvent.click(screen.getByText('Resume'))
    expect(mockControlAST).toHaveBeenCalledWith('resume')
  })

  it('calls controlAST cancel when Cancel is clicked', () => {
    const mockControlAST = vi.fn()
    mockUseAST.mockReturnValue({
      runAST: vi.fn(),
      controlAST: mockControlAST,
      execution: {
        status: 'running',
        progress: { current: 1, total: 5, message: 'Running' },
        items: [],
        error: null,
      },
    })
    mockGetAST.mockReturnValue({
      name: 'login',
      label: 'Login',
      FormComponent: () => <div>Form</div>,
    })
    render(<ASTPanel sessionId="s1" />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(mockControlAST).toHaveBeenCalledWith('cancel')
  })

  it('calls clearExecution when Clear is clicked', () => {
    mockUseASTStore.mockReturnValue(mockClearExecution)
    mockUseAST.mockReturnValue({
      runAST: vi.fn(),
      controlAST: vi.fn(),
      execution: {
        status: 'completed',
        progress: { current: 5, total: 5, message: 'Done' },
        items: [],
        error: null,
      },
    })
    mockGetAST.mockReturnValue({
      name: 'login',
      label: 'Login',
      FormComponent: () => <div>Form</div>,
    })
    render(<ASTPanel sessionId="s1" />)
    fireEvent.click(screen.getByText('Clear'))
    expect(mockClearExecution).toHaveBeenCalledWith('s1')
  })

  it('renders virtual items when present', () => {
    mockVirtualItems.items = [
      { index: 0, key: '0', size: 28, start: 0 },
      { index: 1, key: '1', size: 28, start: 28 },
    ]
    mockUseAST.mockReturnValue({
      runAST: vi.fn(),
      controlAST: vi.fn(),
      execution: {
        status: 'completed',
        progress: { current: 2, total: 2, message: 'Done' },
        items: [
          { policyNumber: 'POL-001', status: 'success', durationMs: 150 },
          { policyNumber: 'POL-002', status: 'error', durationMs: 300 },
        ],
        error: null,
      },
    })
    mockGetAST.mockReturnValue({
      name: 'login',
      label: 'Login',
      FormComponent: () => <div>Form</div>,
    })
    mockUseASTStore.mockReturnValue(vi.fn())
    render(<ASTPanel sessionId="s1" />)
    expect(screen.getByText('POL-001')).toBeDefined()
    expect(screen.getByText('POL-002')).toBeDefined()
    expect(screen.getByText('success')).toBeDefined()
    expect(screen.getByText('error')).toBeDefined()
    // Reset virtual items for subsequent tests
    mockVirtualItems.items = []
  })

  it('shows cancelled status color', () => {
    mockUseAST.mockReturnValue({
      runAST: vi.fn(),
      controlAST: vi.fn(),
      execution: {
        status: 'cancelled',
        progress: { current: 2, total: 5, message: 'Cancelled' },
        items: [],
        error: null,
      },
    })
    mockGetAST.mockReturnValue({
      name: 'login',
      label: 'Login',
      FormComponent: () => <div>Form</div>,
    })
    mockUseASTStore.mockReturnValue(vi.fn())
    render(<ASTPanel sessionId="s1" />)
    expect(screen.getByText(/cancelled/)).toBeDefined()
  })

  it('shows progress percentage', () => {
    mockUseAST.mockReturnValue({
      runAST: vi.fn(),
      controlAST: vi.fn(),
      execution: {
        status: 'running',
        progress: { current: 1, total: 2, message: 'Working' },
        items: [],
        error: null,
      },
    })
    mockGetAST.mockReturnValue({
      name: 'login',
      label: 'Login',
      FormComponent: () => <div>Form</div>,
    })
    render(<ASTPanel sessionId="s1" />)
    expect(screen.getByText(/50%/)).toBeDefined()
  })
})
