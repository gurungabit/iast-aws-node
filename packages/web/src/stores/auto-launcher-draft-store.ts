import { create } from 'zustand'
import type { AutoLauncherDto } from '../services/auto-launchers'

export interface DraftStep {
  stepId: string
  astName: string
  configId: string
  configName?: string
  order: number
}

export interface TabDraft {
  selectedLauncher: AutoLauncherDto | null
  name: string
  visibility: 'private' | 'public'
  steps: DraftStep[]
  newStepAstName: string | null
  newStepConfigId: string | null
}

function createDefaultDraft(): TabDraft {
  return {
    selectedLauncher: null,
    name: '',
    visibility: 'private',
    steps: [],
    newStepAstName: null,
    newStepConfigId: null,
  }
}

interface DraftState {
  drafts: Record<string, TabDraft>
  upsertDraft: (tabId: string, data: Partial<TabDraft>) => void
  resetDraft: (tabId: string) => void
}

export const useAutoLauncherDraftStore = create<DraftState>((set) => ({
  drafts: {},

  upsertDraft: (tabId, data) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [tabId]: { ...(state.drafts[tabId] ?? createDefaultDraft()), ...data },
      },
    })),

  resetDraft: (tabId) =>
    set((state) => ({
      drafts: { ...state.drafts, [tabId]: createDefaultDraft() },
    })),
}))
