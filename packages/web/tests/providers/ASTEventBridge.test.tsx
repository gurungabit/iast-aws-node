import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

const mockStoreGetState = vi.hoisted(() => vi.fn())
const { mockTabs } = vi.hoisted(() => ({
  mockTabs: { current: new Map() as Map<string, unknown> },
}))

vi.mock('@src/stores/session-store', () => ({
  useSessionStore: (selector: (s: { tabs: Map<string, unknown> }) => unknown) =>
    selector({ tabs: mockTabs.current }),
}))

vi.mock('@src/stores/ast-store', () => ({
  useASTStore: Object.assign(vi.fn(), {
    getState: mockStoreGetState,
  }),
}))

import { ASTEventBridge } from '@src/providers/ASTEventBridge'

describe('ASTEventBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTabs.current = new Map()
    mockStoreGetState.mockReturnValue({
      addStatusMessage: vi.fn(),
      handleASTStatus: vi.fn(),
      handleASTProgress: vi.fn(),
      handleASTItemResults: vi.fn(),
      handleASTComplete: vi.fn(),
    })
    cleanup()
  })

  it('renders nothing', () => {
    const { container } = render(<ASTEventBridge />)
    expect(container.innerHTML).toBe('')
  })

  it('sets up message handlers on tabs with WS connections', () => {
    const mockOnMessage = vi.fn().mockReturnValue(() => {})
    mockTabs.current = new Map([['tab-1', { ws: { onMessage: mockOnMessage, send: vi.fn() } }]])

    render(<ASTEventBridge />)

    expect(mockOnMessage).toHaveBeenCalledTimes(1)
  })

  it('skips tabs without WS connections', () => {
    const mockOnMessage = vi.fn().mockReturnValue(() => {})
    mockTabs.current = new Map([
      ['tab-1', { ws: null }],
      ['tab-2', { ws: { onMessage: mockOnMessage, send: vi.fn() } }],
    ])

    render(<ASTEventBridge />)

    expect(mockOnMessage).toHaveBeenCalledTimes(1)
  })

  it('routes ast.status to handleASTStatus', () => {
    const mockHandleASTStatus = vi.fn()
    const mockAddStatusMessage = vi.fn()
    mockStoreGetState.mockReturnValue({
      addStatusMessage: mockAddStatusMessage,
      handleASTStatus: mockHandleASTStatus,
      handleASTProgress: vi.fn(),
      handleASTItemResults: vi.fn(),
      handleASTComplete: vi.fn(),
    })

    let handler: (msg: unknown) => void = () => {}
    const mockOnMessage = vi.fn().mockImplementation((h: (msg: unknown) => void) => {
      handler = h
      return () => {}
    })
    mockTabs.current = new Map([['tab-1', { ws: { onMessage: mockOnMessage, send: vi.fn() } }]])

    render(<ASTEventBridge />)
    handler({ type: 'ast.status', status: 'running', astName: 'login', executionId: 'exec-1' })

    expect(mockAddStatusMessage).toHaveBeenCalledWith('tab-1', '[login] running')
    expect(mockHandleASTStatus).toHaveBeenCalledWith('tab-1', {
      astName: 'login',
      status: 'running',
    })
  })

  it('routes ast.complete to handleASTComplete', () => {
    const mockHandleASTComplete = vi.fn()
    mockStoreGetState.mockReturnValue({
      addStatusMessage: vi.fn(),
      handleASTStatus: vi.fn(),
      handleASTProgress: vi.fn(),
      handleASTItemResults: vi.fn(),
      handleASTComplete: mockHandleASTComplete,
    })

    let handler: (msg: unknown) => void = () => {}
    const mockOnMessage = vi.fn().mockImplementation((h: (msg: unknown) => void) => {
      handler = h
      return () => {}
    })
    mockTabs.current = new Map([['tab-1', { ws: { onMessage: mockOnMessage, send: vi.fn() } }]])

    render(<ASTEventBridge />)
    handler({ type: 'ast.complete', status: 'failed', executionId: 'exec-1', error: 'Timeout' })

    expect(mockHandleASTComplete).toHaveBeenCalledWith('tab-1', {
      status: 'failed',
      message: 'Timeout',
    })
  })

  it('cleans up handlers on unmount', () => {
    const cleanupFn = vi.fn()
    const mockOnMessage = vi.fn().mockReturnValue(cleanupFn)
    mockTabs.current = new Map([['tab-1', { ws: { onMessage: mockOnMessage, send: vi.fn() } }]])

    const { unmount } = render(<ASTEventBridge />)
    expect(cleanupFn).not.toHaveBeenCalled()
    unmount()
    expect(cleanupFn).toHaveBeenCalledTimes(1)
  })
})
