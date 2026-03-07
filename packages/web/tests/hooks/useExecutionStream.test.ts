import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
    vi.useFakeTimers()
    mockTabs.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it('streams live policy results from WS after throttle', () => {
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

    // Send items — not yet flushed
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

    // Before throttle fires, still empty
    expect(result.current?.livePolicies).toHaveLength(0)

    // Advance timer to flush
    act(() => {
      vi.advanceTimersByTime(300)
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
      vi.advanceTimersByTime(300)
    })

    expect(result.current?.livePolicies).toHaveLength(0)
  })

  it('tracks completion status immediately (no throttle)', () => {
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

    // Completion flushes immediately
    expect(result.current?.completed).toBe(true)
    expect(result.current?.completedStatus).toBe('completed')
  })

  it('tracks progress updates after throttle', () => {
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
      vi.advanceTimersByTime(300)
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
      vi.advanceTimersByTime(300)
    })

    expect(result.current?.livePolicies).toHaveLength(1)
    expect(result.current?.livePolicies[0].status).toBe('failure')
  })

  it('batches multiple rapid updates into single flush', () => {
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

    // Rapid-fire 100 progress + item messages
    act(() => {
      for (let i = 0; i < 100; i++) {
        handler?.({
          type: 'ast.progress',
          progress: { current: i, total: 100, message: `Item ${i}` },
        })
        handler?.({
          type: 'ast.item_result_batch',
          executionId: 'exec-1',
          items: [{ id: `p${i}`, policyNumber: `POL${i}`, status: 'success', durationMs: 10 }],
        })
      }
    })

    // Before flush: still no data
    expect(result.current?.livePolicies).toHaveLength(0)

    // Single flush gets all 100 items
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current?.livePolicies).toHaveLength(100)
    expect(result.current?.progress?.current).toBe(99)
  })
})
