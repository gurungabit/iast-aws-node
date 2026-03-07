import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useAutoLauncherDraftStore } from '@src/stores/auto-launcher-draft-store'

describe('useAutoLauncherDraftStore', () => {
  beforeEach(() => {
    act(() => {
      // Reset all drafts by setting empty object
      useAutoLauncherDraftStore.setState({ drafts: {} })
    })
  })

  describe('initial state', () => {
    it('starts with empty drafts object', () => {
      expect(useAutoLauncherDraftStore.getState().drafts).toEqual({})
    })
  })

  describe('resetDraft', () => {
    it('creates a default draft for the given tab', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().resetDraft('tab-1')
      })

      const draft = useAutoLauncherDraftStore.getState().drafts['tab-1']
      expect(draft).toBeDefined()
      expect(draft.name).toBe('')
      expect(draft.visibility).toBe('private')
      expect(draft.steps).toEqual([])
      expect(draft.selectedLauncher).toBeNull()
      expect(draft.newStepAstName).toBeNull()
      expect(draft.newStepConfigId).toBeNull()
      expect(draft.hostUsername).toBe('')
      expect(draft.hostPassword).toBe('')
    })

    it('resets an existing draft back to defaults', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().upsertDraft('tab-1', {
          name: 'My Launcher',
          visibility: 'public',
          steps: [{ stepId: 's1', astName: 'login', configId: 'c1', order: 0 }],
        })
      })

      act(() => {
        useAutoLauncherDraftStore.getState().resetDraft('tab-1')
      })

      const draft = useAutoLauncherDraftStore.getState().drafts['tab-1']
      expect(draft.name).toBe('')
      expect(draft.visibility).toBe('private')
      expect(draft.steps).toEqual([])
    })

    it('does not affect other tabs', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().upsertDraft('tab-1', { name: 'Tab 1' })
        useAutoLauncherDraftStore.getState().upsertDraft('tab-2', { name: 'Tab 2' })
      })

      act(() => {
        useAutoLauncherDraftStore.getState().resetDraft('tab-1')
      })

      expect(useAutoLauncherDraftStore.getState().drafts['tab-1'].name).toBe('')
      expect(useAutoLauncherDraftStore.getState().drafts['tab-2'].name).toBe('Tab 2')
    })
  })

  describe('upsertDraft', () => {
    it('creates a new draft with provided fields', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().upsertDraft('tab-1', {
          name: 'Test Launcher',
          visibility: 'public',
        })
      })

      const draft = useAutoLauncherDraftStore.getState().drafts['tab-1']
      expect(draft.name).toBe('Test Launcher')
      expect(draft.visibility).toBe('public')
      // Other fields should be defaults
      expect(draft.steps).toEqual([])
      expect(draft.hostUsername).toBe('')
    })

    it('merges partial updates into existing draft', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().upsertDraft('tab-1', {
          name: 'Original',
          hostUsername: 'USER1',
        })
      })

      act(() => {
        useAutoLauncherDraftStore.getState().upsertDraft('tab-1', {
          name: 'Updated',
        })
      })

      const draft = useAutoLauncherDraftStore.getState().drafts['tab-1']
      expect(draft.name).toBe('Updated')
      expect(draft.hostUsername).toBe('USER1') // preserved
    })

    it('stores steps correctly', () => {
      const steps = [
        { stepId: 's1', astName: 'login', configId: 'c1', order: 0 },
        { stepId: 's2', astName: 'bi_renew', configId: 'c2', order: 1 },
      ]

      act(() => {
        useAutoLauncherDraftStore.getState().upsertDraft('tab-1', { steps })
      })

      expect(useAutoLauncherDraftStore.getState().drafts['tab-1'].steps).toEqual(steps)
      expect(useAutoLauncherDraftStore.getState().drafts['tab-1'].steps).toHaveLength(2)
    })

    it('stores selectedLauncher', () => {
      const launcher = {
        id: 'l1',
        ownerId: 'u1',
        name: 'Saved Launcher',
        visibility: 'private',
        steps: [],
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      }

      act(() => {
        useAutoLauncherDraftStore.getState().upsertDraft('tab-1', { selectedLauncher: launcher })
      })

      expect(useAutoLauncherDraftStore.getState().drafts['tab-1'].selectedLauncher).toEqual(launcher)
    })

    it('stores newStepAstName and newStepConfigId', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().upsertDraft('tab-1', {
          newStepAstName: 'login',
          newStepConfigId: 'cfg-123',
        })
      })

      const draft = useAutoLauncherDraftStore.getState().drafts['tab-1']
      expect(draft.newStepAstName).toBe('login')
      expect(draft.newStepConfigId).toBe('cfg-123')
    })

    it('stores credentials', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().upsertDraft('tab-1', {
          hostUsername: 'HERC01',
          hostPassword: 'secret',
        })
      })

      const draft = useAutoLauncherDraftStore.getState().drafts['tab-1']
      expect(draft.hostUsername).toBe('HERC01')
      expect(draft.hostPassword).toBe('secret')
    })
  })

  describe('per-tab isolation', () => {
    it('maintains independent drafts per tab', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().upsertDraft('tab-1', {
          name: 'Launcher A',
          visibility: 'private',
        })
        useAutoLauncherDraftStore.getState().upsertDraft('tab-2', {
          name: 'Launcher B',
          visibility: 'public',
        })
      })

      const drafts = useAutoLauncherDraftStore.getState().drafts
      expect(drafts['tab-1'].name).toBe('Launcher A')
      expect(drafts['tab-1'].visibility).toBe('private')
      expect(drafts['tab-2'].name).toBe('Launcher B')
      expect(drafts['tab-2'].visibility).toBe('public')
    })

    it('updating one tab does not affect another', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().upsertDraft('tab-1', { name: 'A' })
        useAutoLauncherDraftStore.getState().upsertDraft('tab-2', { name: 'B' })
      })

      act(() => {
        useAutoLauncherDraftStore.getState().upsertDraft('tab-1', { name: 'A Updated' })
      })

      expect(useAutoLauncherDraftStore.getState().drafts['tab-2'].name).toBe('B')
    })

    it('resetting one tab does not affect another', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().upsertDraft('tab-1', { name: 'Keep me' })
        useAutoLauncherDraftStore.getState().upsertDraft('tab-2', { name: 'Reset me' })
      })

      act(() => {
        useAutoLauncherDraftStore.getState().resetDraft('tab-2')
      })

      expect(useAutoLauncherDraftStore.getState().drafts['tab-1'].name).toBe('Keep me')
      expect(useAutoLauncherDraftStore.getState().drafts['tab-2'].name).toBe('')
    })
  })
})
