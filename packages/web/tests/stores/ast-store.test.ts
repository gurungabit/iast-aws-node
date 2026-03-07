import { describe, it, expect, beforeEach } from 'vitest'
import { useASTStore } from '@src/stores/ast-store'
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

    it('records startedAt timestamp', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().executeAST('tab-1', 'login')
      })
      const tab = useASTStore.getState().tabs['tab-1']
      expect(tab.startedAt).toBeTypeOf('number')
      expect(tab.startedAt).toBeGreaterThan(0)
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

    it('computes duration from startedAt', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().executeAST('tab-1', 'login')
      })
      // Simulate some elapsed time
      act(() => {
        useASTStore.getState().handleASTComplete('tab-1', { status: 'completed' })
      })
      const tab = useASTStore.getState().tabs['tab-1']
      expect(tab.lastResult).toBeDefined()
      expect(tab.lastResult!.duration).toBeTypeOf('number')
      expect(tab.lastResult!.duration).toBeGreaterThanOrEqual(0)
      expect(tab.startedAt).toBeNull()
    })

    it('preserves explicit duration over computed one', () => {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().executeAST('tab-1', 'login')
        useASTStore.getState().handleASTComplete('tab-1', { status: 'completed', duration: 42.5 })
      })
      const tab = useASTStore.getState().tabs['tab-1']
      expect(tab.lastResult!.duration).toBe(42.5)
    })
  })

  describe('handleASTComplete with AutoLauncher', () => {
    function setupAutoLauncher() {
      act(() => {
        useASTStore.getState().initTab('tab-1')
        useASTStore.getState().executeAST('tab-1', 'login')
        useASTStore.getState().beginAutoLauncherRun('tab-1', {
          runId: 'run-1',
          launcherId: 'l-1',
          steps: [
            { astName: 'login', configId: 'c1', order: 0 },
            { astName: 'bi_renew', configId: 'c2', order: 1 },
            { astName: 'rout_extractor', configId: 'c3', order: 2 },
          ],
        })
      })
    }

    it('marks current step as success and advances nextStepIndex', () => {
      setupAutoLauncher()

      act(() => {
        useASTStore.getState().handleASTComplete('tab-1', { status: 'completed' })
      })

      const run = useASTStore.getState().tabs['tab-1'].autoLauncherRun!
      expect(run.steps[0].status).toBe('success')
      expect(run.nextStepIndex).toBe(1)
      expect(run.status).toBe('running')
    })

    it('keeps tab status as running when more steps remain', () => {
      setupAutoLauncher()

      act(() => {
        useASTStore.getState().handleASTComplete('tab-1', { status: 'completed' })
      })

      const tab = useASTStore.getState().tabs['tab-1']
      expect(tab.status).toBe('running')
      expect(tab.lastResult).toBeNull()
      expect(tab.progress).toBeNull()
    })

    it('marks run as completed when last step completes', () => {
      setupAutoLauncher()

      act(() => {
        useASTStore.getState().handleASTComplete('tab-1', { status: 'completed' })
        useASTStore.getState().handleASTComplete('tab-1', { status: 'completed' })
        useASTStore.getState().handleASTComplete('tab-1', { status: 'completed' })
      })

      const run = useASTStore.getState().tabs['tab-1'].autoLauncherRun!
      expect(run.steps[0].status).toBe('success')
      expect(run.steps[1].status).toBe('success')
      expect(run.steps[2].status).toBe('success')
      expect(run.status).toBe('completed')
      expect(run.nextStepIndex).toBe(3)
    })

    it('marks step as failed and run as failed on failure', () => {
      setupAutoLauncher()

      act(() => {
        useASTStore.getState().handleASTComplete('tab-1', { status: 'completed' })
        useASTStore.getState().handleASTComplete('tab-1', { status: 'failed', message: 'Login timeout' })
      })

      const run = useASTStore.getState().tabs['tab-1'].autoLauncherRun!
      expect(run.steps[0].status).toBe('success')
      expect(run.steps[1].status).toBe('failed')
      expect(run.steps[1].error).toBe('Login timeout')
      expect(run.status).toBe('failed')
      expect(run.lastError).toBe('Login timeout')
    })

    it('resets progress between steps', () => {
      setupAutoLauncher()

      act(() => {
        useASTStore.getState().handleASTProgress('tab-1', {
          current: 50, total: 100, percentage: 50, message: 'step 1',
        })
        useASTStore.getState().handleASTComplete('tab-1', { status: 'completed' })
      })

      const tab = useASTStore.getState().tabs['tab-1']
      expect(tab.progress).toBeNull()
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
