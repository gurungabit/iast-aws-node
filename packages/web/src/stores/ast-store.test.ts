import { describe, it, expect, beforeEach } from 'vitest'
import { useASTStore } from './ast-store'
import { act } from '@testing-library/react'

describe('useASTStore', () => {
  beforeEach(() => {
    act(() => {
      useASTStore.setState({ tabs: {}, activeTabId: null })
    })
  })

  describe('initTab', () => {
    it('creates default tab state', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
      })
      const tab = useASTStore.getState().tabs['tab-1']
      expect(tab).toBeDefined()
      expect(tab.status).toBe('idle')
      expect(tab.selectedASTId).toBeNull()
      expect(tab.credentials).toEqual({ username: '', password: '' })
      expect(tab.customFields).toEqual({})
    })

    it('does not overwrite existing tab', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().setCredentials('tab-1', { username: 'test' })
        useASTStore.getState().initTab('tab-1')
      })
      expect(useASTStore.getState().tabs['tab-1'].credentials.username).toBe('test')
    })
  })

  describe('removeTab', () => {
    it('removes a tab', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().removeTab('tab-1')
      })
      expect(useASTStore.getState().tabs['tab-1']).toBeUndefined()
    })
  })

  describe('setSelectedASTId', () => {
    it('sets the selected AST for a tab', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().setSelectedASTId('tab-1', 'login')
      })
      expect(useASTStore.getState().tabs['tab-1'].selectedASTId).toBe('login')
    })
  })

  describe('setCredentials', () => {
    it('updates credentials', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().setCredentials('tab-1', { username: 'user', password: 'pass' })
      })
      expect(useASTStore.getState().tabs['tab-1'].credentials).toEqual({
        username: 'user',
        password: 'pass',
      })
    })

    it('merges partial credentials', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().setCredentials('tab-1', { username: 'user' })
      })
      expect(useASTStore.getState().tabs['tab-1'].credentials).toEqual({
        username: 'user',
        password: '',
      })
    })
  })

  describe('setCustomField', () => {
    it('stores a custom field', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().setCustomField('tab-1', 'myField', 42)
      })
      expect(useASTStore.getState().tabs['tab-1'].customFields['myField']).toBe(42)
    })
  })

  describe('executeAST', () => {
    it('sets running state', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().executeAST('tab-1', 'login')
      })
      const tab = useASTStore.getState().tabs['tab-1']
      expect(tab.status).toBe('running')
      expect(tab.runningAST).toBe('login')
      expect(tab.itemResults).toEqual([])
    })
  })

  describe('handleASTStatus', () => {
    it('updates status', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().handleASTStatus('tab-1', { astName: 'login', status: 'running' })
      })
      expect(useASTStore.getState().tabs['tab-1'].status).toBe('running')
    })

    it('does nothing for nonexistent tab', () => {
      act(() => {
        useASTStore.getState().handleASTStatus('nonexistent', {
          astName: 'login',
          status: 'running',
        })
      })
      expect(useASTStore.getState().tabs['nonexistent']).toBeUndefined()
    })
  })

  describe('handleASTProgress', () => {
    it('updates progress', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().handleASTProgress('tab-1', {
          current: 5,
          total: 10,
          message: 'Processing...',
          percentage: 50,
        })
      })
      expect(useASTStore.getState().tabs['tab-1'].progress).toEqual({
        current: 5,
        total: 10,
        message: 'Processing...',
        percentage: 50,
      })
    })
  })

  describe('handleASTItemResults', () => {
    it('appends item results', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().handleASTItemResults('tab-1', [
          { id: 'i1', policyNumber: 'P1', status: 'success', durationMs: 100 },
        ])
        useASTStore.getState().handleASTItemResults('tab-1', [
          { id: 'i2', policyNumber: 'P2', status: 'failure', durationMs: 200, error: 'fail' },
        ])
      })
      expect(useASTStore.getState().tabs['tab-1'].itemResults).toHaveLength(2)
    })
  })

  describe('handleASTComplete', () => {
    it('sets completed status', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().executeAST('tab-1', 'login')
        useASTStore.getState().handleASTComplete('tab-1', { status: 'completed' })
      })
      const tab = useASTStore.getState().tabs['tab-1']
      expect(tab.status).toBe('completed')
      expect(tab.runningAST).toBeNull()
    })

    it('sets failed status with error', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().executeAST('tab-1', 'login')
        useASTStore.getState().handleASTComplete('tab-1', {
          status: 'failed',
          message: 'Timeout',
        })
      })
      const tab = useASTStore.getState().tabs['tab-1']
      expect(tab.status).toBe('failed')
    })
  })

  describe('clearLogs', () => {
    it('resets execution state', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().executeAST('tab-1', 'login')
        useASTStore.getState().addStatusMessage('tab-1', 'test message')
        useASTStore.getState().clearLogs('tab-1')
      })
      const tab = useASTStore.getState().tabs['tab-1']
      expect(tab.status).toBe('idle')
      expect(tab.statusMessages).toEqual([])
      expect(tab.itemResults).toEqual([])
    })
  })

  describe('multiple tabs', () => {
    it('supports independent tab state', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().initTab('tab-2')
        useASTStore.getState().executeAST('tab-1', 'login')
      })
      expect(useASTStore.getState().tabs['tab-1'].status).toBe('running')
      expect(useASTStore.getState().tabs['tab-2'].status).toBe('idle')
    })
  })
})
