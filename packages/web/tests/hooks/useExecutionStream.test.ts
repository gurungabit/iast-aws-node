import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useExecutionStream } from '../../src/hooks/useExecutionStream'
import type { ASTItemResult, ASTProgress, ASTStatus } from '../../src/ast/types'

// Mock AST store
interface MockTabState {
  itemResults: ASTItemResult[]
  progress: ASTProgress | null
  status: ASTStatus
}

const mockTabs: Record<string, MockTabState> = {}

vi.mock('../../src/stores/ast-store', () => ({
  useASTStore: (selector: (s: { tabs: typeof mockTabs }) => unknown) =>
    selector({ tabs: mockTabs }),
}))

describe('useExecutionStream', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockTabs)) {
      delete mockTabs[key]
    }
  })

  it('returns null when sessionId is null', () => {
    const { result } = renderHook(() =>
      useExecutionStream('exec-1', null, true),
    )
    expect(result.current).toBeNull()
  })

  it('returns null when not running', () => {
    mockTabs['session-1'] = { itemResults: [], progress: null, status: 'running' }

    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', false),
    )
    expect(result.current).toBeNull()
  })

  it('returns null when session has no tab in AST store', () => {
    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', true),
    )
    expect(result.current).toBeNull()
  })

  it('returns empty livePolicies when no items yet', () => {
    mockTabs['session-1'] = { itemResults: [], progress: null, status: 'running' }

    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', true),
    )

    expect(result.current).not.toBeNull()
    expect(result.current?.livePolicies).toHaveLength(0)
    expect(result.current?.completed).toBe(false)
  })

  it('maps item results to live policies', () => {
    mockTabs['session-1'] = {
      itemResults: [
        { id: 'p1', policyNumber: 'POL001', status: 'success', durationMs: 1200 },
        { id: 'p2', policyNumber: 'POL002', status: 'failure', durationMs: 800, error: 'timeout' },
      ],
      progress: null,
      status: 'running',
    }

    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', true),
    )

    expect(result.current?.livePolicies).toHaveLength(2)
    expect(result.current?.livePolicies[0].policyNumber).toBe('POL001')
    expect(result.current?.livePolicies[1].error).toBe('timeout')
  })

  it('tracks completion status', () => {
    mockTabs['session-1'] = {
      itemResults: [
        { id: 'p1', policyNumber: 'POL001', status: 'success', durationMs: 100 },
      ],
      progress: null,
      status: 'completed',
    }

    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', true),
    )

    expect(result.current?.completed).toBe(true)
    expect(result.current?.completedStatus).toBe('completed')
  })

  it('tracks failed status', () => {
    mockTabs['session-1'] = {
      itemResults: [],
      progress: null,
      status: 'failed',
    }

    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', true),
    )

    expect(result.current?.completed).toBe(true)
    expect(result.current?.completedStatus).toBe('failed')
  })

  it('returns progress data', () => {
    mockTabs['session-1'] = {
      itemResults: [],
      progress: { current: 5, total: 10, percentage: 50, message: 'Processing...' },
      status: 'running',
    }

    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', true),
    )

    expect(result.current?.progress).toEqual({
      current: 5,
      total: 10,
      message: 'Processing...',
    })
  })

  it('returns null progress when no progress data', () => {
    mockTabs['session-1'] = { itemResults: [], progress: null, status: 'running' }

    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', true),
    )

    expect(result.current?.progress).toBeNull()
  })

  it('normalizes error and data fields', () => {
    mockTabs['session-1'] = {
      itemResults: [
        { id: 'p1', policyNumber: 'POL001', status: 'success', durationMs: 100 },
      ],
      progress: null,
      status: 'running',
    }

    const { result } = renderHook(() =>
      useExecutionStream('exec-1', 'session-1', true),
    )

    expect(result.current?.livePolicies[0].error).toBeNull()
    expect(result.current?.livePolicies[0].data).toBeNull()
  })
})
