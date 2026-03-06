import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useAutoLauncherDraftStore, type DraftStep } from './auto-launcher-draft-store'

function makeStep(overrides: Partial<DraftStep> = {}): DraftStep {
  return {
    id: 'step-1',
    astName: 'AST_A',
    params: {},
    order: 0,
    ...overrides,
  }
}

describe('useAutoLauncherDraftStore', () => {
  beforeEach(() => {
    act(() => {
      useAutoLauncherDraftStore.getState().reset()
    })
  })

  describe('setName', () => {
    it('updates the name', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().setName('My Launcher')
      })
      expect(useAutoLauncherDraftStore.getState().name).toBe('My Launcher')
    })
  })

  describe('setVisibility', () => {
    it('updates visibility to public', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().setVisibility('public')
      })
      expect(useAutoLauncherDraftStore.getState().visibility).toBe('public')
    })

    it('updates visibility to private', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().setVisibility('public')
        useAutoLauncherDraftStore.getState().setVisibility('private')
      })
      expect(useAutoLauncherDraftStore.getState().visibility).toBe('private')
    })
  })

  describe('addStep', () => {
    it('adds a step to empty steps array', () => {
      const step = makeStep()
      act(() => {
        useAutoLauncherDraftStore.getState().addStep(step)
      })
      const { steps } = useAutoLauncherDraftStore.getState()
      expect(steps).toHaveLength(1)
      expect(steps[0]).toEqual(step)
    })

    it('appends multiple steps', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's1', order: 0 }))
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's2', order: 1 }))
      })
      expect(useAutoLauncherDraftStore.getState().steps).toHaveLength(2)
    })
  })

  describe('updateStep', () => {
    it('updates a specific step by id', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's1', astName: 'AST_A' }))
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's2', astName: 'AST_B', order: 1 }))
      })
      act(() => {
        useAutoLauncherDraftStore.getState().updateStep('s1', { astName: 'AST_C' })
      })
      const { steps } = useAutoLauncherDraftStore.getState()
      expect(steps[0].astName).toBe('AST_C')
      expect(steps[1].astName).toBe('AST_B')
    })

    it('does not modify other steps', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's1', order: 0 }))
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's2', order: 1, astName: 'Original' }))
      })
      act(() => {
        useAutoLauncherDraftStore.getState().updateStep('s1', { params: { key: 'val' } })
      })
      expect(useAutoLauncherDraftStore.getState().steps[1].astName).toBe('Original')
    })
  })

  describe('removeStep', () => {
    it('removes a step by id', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's1', order: 0 }))
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's2', order: 1 }))
      })
      act(() => {
        useAutoLauncherDraftStore.getState().removeStep('s1')
      })
      const { steps } = useAutoLauncherDraftStore.getState()
      expect(steps).toHaveLength(1)
      expect(steps[0].id).toBe('s2')
    })

    it('reorders remaining steps after removal', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's1', order: 0 }))
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's2', order: 1 }))
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's3', order: 2 }))
      })
      act(() => {
        useAutoLauncherDraftStore.getState().removeStep('s1')
      })
      const { steps } = useAutoLauncherDraftStore.getState()
      expect(steps[0].order).toBe(0)
      expect(steps[1].order).toBe(1)
    })
  })

  describe('reorderSteps', () => {
    it('moves a step from one index to another', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's1', astName: 'A', order: 0 }))
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's2', astName: 'B', order: 1 }))
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's3', astName: 'C', order: 2 }))
      })
      act(() => {
        useAutoLauncherDraftStore.getState().reorderSteps(0, 2)
      })
      const { steps } = useAutoLauncherDraftStore.getState()
      expect(steps[0].id).toBe('s2')
      expect(steps[1].id).toBe('s3')
      expect(steps[2].id).toBe('s1')
    })

    it('reassigns order values after reorder', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's1', order: 0 }))
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's2', order: 1 }))
        useAutoLauncherDraftStore.getState().addStep(makeStep({ id: 's3', order: 2 }))
      })
      act(() => {
        useAutoLauncherDraftStore.getState().reorderSteps(2, 0)
      })
      const { steps } = useAutoLauncherDraftStore.getState()
      expect(steps[0].order).toBe(0)
      expect(steps[1].order).toBe(1)
      expect(steps[2].order).toBe(2)
    })
  })

  describe('setEditingId', () => {
    it('sets editingId', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().setEditingId('edit-1')
      })
      expect(useAutoLauncherDraftStore.getState().editingId).toBe('edit-1')
    })

    it('clears editingId with null', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().setEditingId('edit-1')
        useAutoLauncherDraftStore.getState().setEditingId(null)
      })
      expect(useAutoLauncherDraftStore.getState().editingId).toBeNull()
    })
  })

  describe('loadFromExisting', () => {
    it('loads data from a launcher object', () => {
      const launcher = {
        name: 'Existing Launcher',
        visibility: 'public',
        steps: [
          makeStep({ id: 'x1', astName: 'AST_X', order: 0 }),
          makeStep({ id: 'x2', astName: 'AST_Y', order: 1 }),
        ],
      }
      act(() => {
        useAutoLauncherDraftStore.getState().loadFromExisting(launcher)
      })
      const state = useAutoLauncherDraftStore.getState()
      expect(state.name).toBe('Existing Launcher')
      expect(state.visibility).toBe('public')
      expect(state.steps).toHaveLength(2)
      expect(state.steps[0].astName).toBe('AST_X')
    })

    it('handles empty steps array', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().loadFromExisting({
          name: 'Empty',
          visibility: 'private',
          steps: [],
        })
      })
      expect(useAutoLauncherDraftStore.getState().steps).toHaveLength(0)
    })
  })

  describe('reset', () => {
    it('clears all state back to defaults', () => {
      act(() => {
        useAutoLauncherDraftStore.getState().setName('Test')
        useAutoLauncherDraftStore.getState().setVisibility('public')
        useAutoLauncherDraftStore.getState().addStep(makeStep())
        useAutoLauncherDraftStore.getState().setEditingId('e1')
      })
      act(() => {
        useAutoLauncherDraftStore.getState().reset()
      })
      const state = useAutoLauncherDraftStore.getState()
      expect(state.name).toBe('')
      expect(state.visibility).toBe('private')
      expect(state.steps).toHaveLength(0)
      expect(state.editingId).toBeNull()
    })
  })

  describe('initial state', () => {
    it('starts with correct defaults', () => {
      const state = useAutoLauncherDraftStore.getState()
      expect(state.name).toBe('')
      expect(state.visibility).toBe('private')
      expect(state.steps).toEqual([])
      expect(state.editingId).toBeNull()
    })
  })
})
