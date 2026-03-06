import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

const { mockStartExecution, mockUpdateStatus, mockUpdateProgress, mockAddItemBatch, mockCompleteExecution } =
  vi.hoisted(() => ({
    mockStartExecution: vi.fn(),
    mockUpdateStatus: vi.fn(),
    mockUpdateProgress: vi.fn(),
    mockAddItemBatch: vi.fn(),
    mockCompleteExecution: vi.fn(),
  }))

const { mockTabs } = vi.hoisted(() => ({
  mockTabs: { current: new Map() as Map<string, unknown> },
}))

vi.mock('../stores/session-store', () => ({
  useSessionStore: (selector: (s: { tabs: Map<string, unknown> }) => unknown) =>
    selector({ tabs: mockTabs.current }),
}))

vi.mock('../stores/ast-store', () => ({
  useASTStore: () => ({
    startExecution: mockStartExecution,
    updateStatus: mockUpdateStatus,
    updateProgress: mockUpdateProgress,
    addItemBatch: mockAddItemBatch,
    completeExecution: mockCompleteExecution,
  }),
}))

import { ASTEventBridge } from './ASTEventBridge'

describe('ASTEventBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTabs.current = new Map()
    cleanup()
  })

  it('renders nothing (returns null)', () => {
    const { container } = render(<ASTEventBridge />)

    expect(container.innerHTML).toBe('')
  })

  it('sets up message handlers on tabs with WS connections', () => {
    const mockOnMessage = vi.fn().mockReturnValue(() => {})
    mockTabs.current = new Map([
      ['session-1', { ws: { onMessage: mockOnMessage }, connected: true }],
    ])

    render(<ASTEventBridge />)

    expect(mockOnMessage).toHaveBeenCalledTimes(1)
    expect(typeof mockOnMessage.mock.calls[0][0]).toBe('function')
  })

  it('skips tabs without WS connections', () => {
    const mockOnMessage = vi.fn().mockReturnValue(() => {})
    mockTabs.current = new Map([
      ['session-1', { ws: null, connected: false }],
      ['session-2', { ws: { onMessage: mockOnMessage }, connected: true }],
    ])

    render(<ASTEventBridge />)

    expect(mockOnMessage).toHaveBeenCalledTimes(1)
  })

  it('routes ast.status with running status to startExecution', () => {
    let handler: (msg: unknown) => void = () => {}
    const mockOnMessage = vi.fn().mockImplementation((h: (msg: unknown) => void) => {
      handler = h
      return () => {}
    })
    mockTabs.current = new Map([
      ['session-1', { ws: { onMessage: mockOnMessage }, connected: true }],
    ])

    render(<ASTEventBridge />)

    handler({ type: 'ast.status', status: 'running', astName: 'LoginAST', executionId: 'exec-1' })

    expect(mockStartExecution).toHaveBeenCalledWith('session-1', 'exec-1', 'LoginAST')
  })

  it('routes ast.status with non-running status to updateStatus', () => {
    let handler: (msg: unknown) => void = () => {}
    const mockOnMessage = vi.fn().mockImplementation((h: (msg: unknown) => void) => {
      handler = h
      return () => {}
    })
    mockTabs.current = new Map([
      ['session-1', { ws: { onMessage: mockOnMessage }, connected: true }],
    ])

    render(<ASTEventBridge />)

    handler({ type: 'ast.status', status: 'paused', astName: 'LoginAST', executionId: 'exec-1' })

    expect(mockUpdateStatus).toHaveBeenCalledWith('session-1', 'paused')
  })

  it('routes ast.progress to updateProgress', () => {
    let handler: (msg: unknown) => void = () => {}
    const mockOnMessage = vi.fn().mockImplementation((h: (msg: unknown) => void) => {
      handler = h
      return () => {}
    })
    mockTabs.current = new Map([
      ['session-1', { ws: { onMessage: mockOnMessage }, connected: true }],
    ])

    render(<ASTEventBridge />)

    const progress = { current: 5, total: 10, message: 'Processing...' }
    handler({ type: 'ast.progress', progress })

    expect(mockUpdateProgress).toHaveBeenCalledWith('session-1', progress)
  })

  it('routes ast.item_result_batch to addItemBatch', () => {
    let handler: (msg: unknown) => void = () => {}
    const mockOnMessage = vi.fn().mockImplementation((h: (msg: unknown) => void) => {
      handler = h
      return () => {}
    })
    mockTabs.current = new Map([
      ['session-1', { ws: { onMessage: mockOnMessage }, connected: true }],
    ])

    render(<ASTEventBridge />)

    const items = [{ id: 'i1', policyNumber: 'P1', status: 'success', durationMs: 100 }]
    handler({ type: 'ast.item_result_batch', executionId: 'exec-1', items })

    expect(mockAddItemBatch).toHaveBeenCalledWith('session-1', items)
  })

  it('routes ast.complete to completeExecution', () => {
    let handler: (msg: unknown) => void = () => {}
    const mockOnMessage = vi.fn().mockImplementation((h: (msg: unknown) => void) => {
      handler = h
      return () => {}
    })
    mockTabs.current = new Map([
      ['session-1', { ws: { onMessage: mockOnMessage }, connected: true }],
    ])

    render(<ASTEventBridge />)

    handler({ type: 'ast.complete', status: 'failed', executionId: 'exec-1', error: 'Timeout' })

    expect(mockCompleteExecution).toHaveBeenCalledWith('session-1', 'failed', 'Timeout')
  })

  it('cleans up handlers on unmount', () => {
    const cleanupFn = vi.fn()
    const mockOnMessage = vi.fn().mockReturnValue(cleanupFn)
    mockTabs.current = new Map([
      ['session-1', { ws: { onMessage: mockOnMessage }, connected: true }],
    ])

    const { unmount } = render(<ASTEventBridge />)

    expect(cleanupFn).not.toHaveBeenCalled()

    unmount()

    expect(cleanupFn).toHaveBeenCalledTimes(1)
  })

  it('cleans up all handlers when multiple tabs exist', () => {
    const cleanup1 = vi.fn()
    const cleanup2 = vi.fn()
    const mockOnMessage1 = vi.fn().mockReturnValue(cleanup1)
    const mockOnMessage2 = vi.fn().mockReturnValue(cleanup2)
    mockTabs.current = new Map([
      ['session-1', { ws: { onMessage: mockOnMessage1 }, connected: true }],
      ['session-2', { ws: { onMessage: mockOnMessage2 }, connected: true }],
    ])

    const { unmount } = render(<ASTEventBridge />)
    unmount()

    expect(cleanup1).toHaveBeenCalledTimes(1)
    expect(cleanup2).toHaveBeenCalledTimes(1)
  })
})
