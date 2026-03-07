import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExecutionStream } from '../../src/hooks/useExecutionStream'
import type { ServerMessage } from '../../src/services/websocket'

// Mock session store
const mockTabs = new Map<string, { ws: { onMessage: ReturnType<typeof vi.fn> } | null }>()

vi.mock('../../src/stores/session-store', () => ({
  useSessionStore: (selector: (s: { tabs: typeof mockTabs }) => unknown) =>
    selector({ tabs: mockTabs }),
}))

describe('useExecutionStream', () => {
  beforeEach(() => {
    mockTabs.clear()
  })

  it('returns null when no WS connection exists', () => {
    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', true),
    )
    expect(result.current).toBeNull()
  })

  it('returns null when not running', () => {
    mockTabs.set('session-1', { ws: { onMessage: vi.fn(() => vi.fn()) } })

    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', false),
    )
    expect(result.current).toBeNull()
  })

  it('returns null when executionId is null', () => {
    mockTabs.set('session-1', { ws: { onMessage: vi.fn(() => vi.fn()) } })

    const { result } = renderHook(() =>
      useExecutionStream(null, 'session-1', true),
    )
    expect(result.current).toBeNull()
  })

  it('streams live policy results from WS', () => {
    let handler: ((msg: ServerMessage) => void) | null = null
    const onMessage = vi.fn((h: (msg: ServerMessage) => void) => {
      handler = h
      return vi.fn()
    })
    mockTabs.set('session-1', { ws: { onMessage } })

    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', true),
    )

    expect(result.current).not.toBeNull()
    expect(result.current?.livePolicies).toHaveLength(0)
    expect(onMessage).toHaveBeenCalled()

    act(() => {
      handler?.({
        type: 'ast.item_result_batch',
        executionId: 'exec-1',
        items: [
          { id: 'p1', policyNumber: 'POL001', status: 'success', durationMs: 1200 },
          { id: 'p2', policyNumber: 'POL002', status: 'failure', durationMs: 800, error: 'timeout' },
        ],
      })
    })

    expect(result.current?.livePolicies).toHaveLength(2)
    expect(result.current?.livePolicies[0].policyNumber).toBe('POL001')
    expect(result.current?.livePolicies[1].error).toBe('timeout')
  })

  it('ignores items for different executionId', () => {
    let handler: ((msg: ServerMessage) => void) | null = null
    mockTabs.set('session-1', {
      ws: {
        onMessage: vi.fn((h: (msg: ServerMessage) => void) => {
          handler = h
          return vi.fn()
        }),
      },
    })

    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', true),
    )

    act(() => {
      handler?.({
        type: 'ast.item_result_batch',
        executionId: 'exec-other',
        items: [{ id: 'p1', policyNumber: 'POL001', status: 'success', durationMs: 100 }],
      })
    })

    expect(result.current?.livePolicies).toHaveLength(0)
  })

  it('tracks completion status', () => {
    let handler: ((msg: ServerMessage) => void) | null = null
    mockTabs.set('session-1', {
      ws: {
        onMessage: vi.fn((h: (msg: ServerMessage) => void) => {
          handler = h
          return vi.fn()
        }),
      },
    })

    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', true),
    )

    expect(result.current?.completed).toBe(false)

    act(() => {
      handler?.({
        type: 'ast.complete',
        executionId: 'exec-1',
        status: 'completed',
      })
    })

    expect(result.current?.completed).toBe(true)
    expect(result.current?.completedStatus).toBe('completed')
  })

  it('tracks progress updates', () => {
    let handler: ((msg: ServerMessage) => void) | null = null
    mockTabs.set('session-1', {
      ws: {
        onMessage: vi.fn((h: (msg: ServerMessage) => void) => {
          handler = h
          return vi.fn()
        }),
      },
    })

    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', true),
    )

    act(() => {
      handler?.({
        type: 'ast.progress',
        progress: { current: 5, total: 10, message: 'Processing...' },
      })
    })

    expect(result.current?.progress).toEqual({
      current: 5,
      total: 10,
      message: 'Processing...',
    })
  })

  it('cleans up WS subscription on unmount', () => {
    const cleanup = vi.fn()
    mockTabs.set('session-1', {
      ws: { onMessage: vi.fn(() => cleanup) },
    })

    const { unmount } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', true),
    )

    unmount()
    expect(cleanup).toHaveBeenCalled()
  })

  it('deduplicates items by id', () => {
    let handler: ((msg: ServerMessage) => void) | null = null
    mockTabs.set('session-1', {
      ws: {
        onMessage: vi.fn((h: (msg: ServerMessage) => void) => {
          handler = h
          return vi.fn()
        }),
      },
    })

    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', true),
    )

    act(() => {
      handler?.({
        type: 'ast.item_result_batch',
        executionId: 'exec-1',
        items: [{ id: 'p1', policyNumber: 'POL001', status: 'success', durationMs: 100 }],
      })
    })

    act(() => {
      handler?.({
        type: 'ast.item_result_batch',
        executionId: 'exec-1',
        items: [{ id: 'p1', policyNumber: 'POL001', status: 'failure', durationMs: 200 }],
      })
    })

    expect(result.current?.livePolicies).toHaveLength(1)
    expect(result.current?.livePolicies[0].status).toBe('failure')
  })
})
