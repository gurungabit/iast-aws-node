import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockSend = vi.hoisted(() => vi.fn())
const mockExecuteAST = vi.hoisted(() => vi.fn())
const mockClearLogs = vi.hoisted(() => vi.fn())

vi.mock('../stores/session-store', () => ({
  useSessionStore: Object.assign(vi.fn().mockReturnValue(null), {
    getState: vi.fn().mockReturnValue({
      tabs: new Map([['tab-1', { ws: { send: mockSend } }]]),
    }),
  }),
}))

vi.mock('../stores/ast-store', () => ({
  useASTStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => {
      if (typeof selector === 'function') {
        return selector({
          activeTabId: 'tab-1',
          tabs: {
            'tab-1': {
              status: 'idle',
              lastResult: null,
              progress: null,
              itemResults: [],
              statusMessages: [],
            },
          },
        })
      }
      return null
    },
    {
      getState: vi.fn().mockReturnValue({
        executeAST: mockExecuteAST,
        clearLogs: mockClearLogs,
      }),
    },
  ),
}))

import { useAST } from './useAST'

describe('useAST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns idle status by default', () => {
    const { result } = renderHook(() => useAST())
    expect(result.current.status).toBe('idle')
    expect(result.current.isRunning).toBe(false)
  })

  it('executeAST sends message via ws and updates store', () => {
    const { result } = renderHook(() => useAST())
    act(() => {
      result.current.executeAST('login', { username: 'u' })
    })
    expect(mockSend).toHaveBeenCalledWith({
      type: 'ast.run',
      astName: 'login',
      params: { username: 'u' },
    })
    expect(mockExecuteAST).toHaveBeenCalledWith('tab-1', 'login', { username: 'u' })
  })

  it('controlAST sends control message via ws', () => {
    const { result } = renderHook(() => useAST())
    act(() => {
      result.current.controlAST('pause')
    })
    expect(mockSend).toHaveBeenCalledWith({ type: 'ast.control', action: 'pause' })
  })

  it('clearLogs delegates to store', () => {
    const { result } = renderHook(() => useAST())
    act(() => {
      result.current.clearLogs()
    })
    expect(mockClearLogs).toHaveBeenCalledWith('tab-1')
  })
})
