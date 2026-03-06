import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockSend = vi.hoisted(() => vi.fn())
const mockGetState = vi.hoisted(() => vi.fn())

vi.mock('../stores/session-store', () => ({
  useSessionStore: Object.assign(
    vi.fn().mockReturnValue(null),
    { getState: mockGetState },
  ),
}))

vi.mock('../stores/ast-store', () => ({
  useASTStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) => {
    if (typeof selector === 'function') {
      return selector({ executions: new Map() })
    }
    return null
  }),
}))

import { useAST } from './useAST'

describe('useAST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({
      tabs: new Map([
        ['session-1', { ws: { send: mockSend } }],
      ]),
    })
  })

  it('runAST sends message via ws', () => {
    const { result } = renderHook(() => useAST('session-1'))
    act(() => {
      result.current.runAST('login', { username: 'u' })
    })
    expect(mockSend).toHaveBeenCalledWith({
      type: 'ast.run',
      astName: 'login',
      params: { username: 'u' },
      configId: undefined,
    })
  })

  it('runAST does nothing when sessionId is null', () => {
    const { result } = renderHook(() => useAST(null))
    act(() => {
      result.current.runAST('login', {})
    })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('runAST does nothing when tab has no ws', () => {
    mockGetState.mockReturnValue({
      tabs: new Map([['session-1', { ws: null }]]),
    })
    const { result } = renderHook(() => useAST('session-1'))
    act(() => {
      result.current.runAST('login', {})
    })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('controlAST sends control message', () => {
    const { result } = renderHook(() => useAST('session-1'))
    act(() => {
      result.current.controlAST('pause')
    })
    expect(mockSend).toHaveBeenCalledWith({ type: 'ast.control', action: 'pause' })
  })

  it('controlAST does nothing when sessionId is null', () => {
    const { result } = renderHook(() => useAST(null))
    act(() => {
      result.current.controlAST('cancel')
    })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('execution returns null for unknown session', () => {
    const { result } = renderHook(() => useAST('unknown'))
    expect(result.current.execution).toBeNull()
  })
})
