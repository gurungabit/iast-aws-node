import { describe, it, expect, beforeEach } from 'vitest'
import { useASTStore } from './ast-store'
import { act } from '@testing-library/react'

describe('useASTStore', () => {
  beforeEach(() => {
    act(() => {
      // Reset store to initial state
      useASTStore.setState({ executions: new Map() })
    })
  })

  describe('startExecution', () => {
    it('creates a new execution entry for a session', () => {
      act(() => {
        useASTStore.getState().startExecution('session-1', 'exec-1', 'LoginAST')
      })

      const exec = useASTStore.getState().getExecution('session-1')
      expect(exec).not.toBeNull()
      expect(exec!.executionId).toBe('exec-1')
      expect(exec!.astName).toBe('LoginAST')
      expect(exec!.status).toBe('running')
      expect(exec!.progress).toEqual({ current: 0, total: 0, message: 'Starting...' })
      expect(exec!.items).toEqual([])
    })

    it('overwrites an existing execution for the same session', () => {
      act(() => {
        useASTStore.getState().startExecution('session-1', 'exec-1', 'LoginAST')
        useASTStore.getState().startExecution('session-1', 'exec-2', 'BiRenew')
      })

      const exec = useASTStore.getState().getExecution('session-1')
      expect(exec!.executionId).toBe('exec-2')
      expect(exec!.astName).toBe('BiRenew')
    })

    it('supports multiple sessions simultaneously', () => {
      act(() => {
        useASTStore.getState().startExecution('session-1', 'exec-1', 'LoginAST')
        useASTStore.getState().startExecution('session-2', 'exec-2', 'BiRenew')
      })

      expect(useASTStore.getState().getExecution('session-1')!.astName).toBe('LoginAST')
      expect(useASTStore.getState().getExecution('session-2')!.astName).toBe('BiRenew')
    })
  })

  describe('updateStatus', () => {
    it('updates the status of an existing execution', () => {
      act(() => {
        useASTStore.getState().startExecution('session-1', 'exec-1', 'LoginAST')
        useASTStore.getState().updateStatus('session-1', 'paused')
      })

      expect(useASTStore.getState().getExecution('session-1')!.status).toBe('paused')
    })

    it('does nothing for a nonexistent session', () => {
      act(() => {
        useASTStore.getState().updateStatus('nonexistent', 'failed')
      })

      expect(useASTStore.getState().getExecution('nonexistent')).toBeNull()
    })
  })

  describe('updateProgress', () => {
    it('updates progress for an existing execution', () => {
      act(() => {
        useASTStore.getState().startExecution('session-1', 'exec-1', 'LoginAST')
        useASTStore.getState().updateProgress('session-1', { current: 5, total: 10, message: 'Processing...' })
      })

      const exec = useASTStore.getState().getExecution('session-1')
      expect(exec!.progress).toEqual({ current: 5, total: 10, message: 'Processing...' })
    })

    it('does nothing for a nonexistent session', () => {
      act(() => {
        useASTStore.getState().updateProgress('nonexistent', { current: 1, total: 1, message: 'test' })
      })

      expect(useASTStore.getState().getExecution('nonexistent')).toBeNull()
    })
  })

  describe('addItemBatch', () => {
    it('appends items to an existing execution', () => {
      const item1 = { id: 'i1', policyNumber: 'P1', status: 'success' as const, durationMs: 100 }
      const item2 = { id: 'i2', policyNumber: 'P2', status: 'failure' as const, durationMs: 200, error: 'fail' }

      act(() => {
        useASTStore.getState().startExecution('session-1', 'exec-1', 'LoginAST')
        useASTStore.getState().addItemBatch('session-1', [item1])
        useASTStore.getState().addItemBatch('session-1', [item2])
      })

      const exec = useASTStore.getState().getExecution('session-1')
      expect(exec!.items).toHaveLength(2)
      expect(exec!.items[0]).toEqual(item1)
      expect(exec!.items[1]).toEqual(item2)
    })

    it('adds multiple items in one batch', () => {
      const items = [
        { id: 'i1', policyNumber: 'P1', status: 'success' as const, durationMs: 100 },
        { id: 'i2', policyNumber: 'P2', status: 'success' as const, durationMs: 150 },
        { id: 'i3', policyNumber: 'P3', status: 'failure' as const, durationMs: 200, error: 'err' },
      ]

      act(() => {
        useASTStore.getState().startExecution('session-1', 'exec-1', 'LoginAST')
        useASTStore.getState().addItemBatch('session-1', items)
      })

      expect(useASTStore.getState().getExecution('session-1')!.items).toHaveLength(3)
    })

    it('does nothing for a nonexistent session', () => {
      act(() => {
        useASTStore.getState().addItemBatch('nonexistent', [
          { id: 'i1', policyNumber: 'P1', status: 'success' as const, durationMs: 100 },
        ])
      })

      expect(useASTStore.getState().getExecution('nonexistent')).toBeNull()
    })
  })

  describe('completeExecution', () => {
    it('sets status to completed', () => {
      act(() => {
        useASTStore.getState().startExecution('session-1', 'exec-1', 'LoginAST')
        useASTStore.getState().completeExecution('session-1', 'completed')
      })

      expect(useASTStore.getState().getExecution('session-1')!.status).toBe('completed')
      expect(useASTStore.getState().getExecution('session-1')!.error).toBeUndefined()
    })

    it('sets status to failed with error message', () => {
      act(() => {
        useASTStore.getState().startExecution('session-1', 'exec-1', 'LoginAST')
        useASTStore.getState().completeExecution('session-1', 'failed', 'Connection timeout')
      })

      const exec = useASTStore.getState().getExecution('session-1')
      expect(exec!.status).toBe('failed')
      expect(exec!.error).toBe('Connection timeout')
    })

    it('does nothing for a nonexistent session', () => {
      act(() => {
        useASTStore.getState().completeExecution('nonexistent', 'completed')
      })

      expect(useASTStore.getState().getExecution('nonexistent')).toBeNull()
    })
  })

  describe('clearExecution', () => {
    it('removes execution for a session', () => {
      act(() => {
        useASTStore.getState().startExecution('session-1', 'exec-1', 'LoginAST')
        useASTStore.getState().clearExecution('session-1')
      })

      expect(useASTStore.getState().getExecution('session-1')).toBeNull()
    })

    it('does not affect other sessions', () => {
      act(() => {
        useASTStore.getState().startExecution('session-1', 'exec-1', 'LoginAST')
        useASTStore.getState().startExecution('session-2', 'exec-2', 'BiRenew')
        useASTStore.getState().clearExecution('session-1')
      })

      expect(useASTStore.getState().getExecution('session-1')).toBeNull()
      expect(useASTStore.getState().getExecution('session-2')).not.toBeNull()
    })
  })

  describe('getExecution', () => {
    it('returns null for nonexistent session', () => {
      expect(useASTStore.getState().getExecution('nope')).toBeNull()
    })

    it('returns the execution object for existing session', () => {
      act(() => {
        useASTStore.getState().startExecution('session-1', 'exec-1', 'LoginAST')
      })

      const exec = useASTStore.getState().getExecution('session-1')
      expect(exec).toEqual({
        executionId: 'exec-1',
        astName: 'LoginAST',
        status: 'running',
        progress: { current: 0, total: 0, message: 'Starting...' },
        items: [],
      })
    })
  })
})
