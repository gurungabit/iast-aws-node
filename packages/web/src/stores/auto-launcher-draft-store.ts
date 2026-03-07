import { create } from 'zustand'

export interface DraftStep {
  id: string
  astName: string
  configId?: string
  params: Record<string, unknown>
  order: number
}

interface DraftState {
  name: string
  visibility: 'private' | 'public'
  steps: DraftStep[]
  editingId: string | null

  setName: (name: string) => void
  setVisibility: (visibility: 'private' | 'public') => void
  addStep: (step: DraftStep) => void
  updateStep: (id: string, data: Partial<DraftStep>) => void
  removeStep: (id: string) => void
  reorderSteps: (fromIndex: number, toIndex: number) => void
  setEditingId: (id: string | null) => void
  loadFromExisting: (launcher: { name: string; visibility: string; steps: unknown[] }) => void
  reset: () => void
}

export const useAutoLauncherDraftStore = create<DraftState>((set) => ({
  name: '',
  visibility: 'private',
  steps: [],
  editingId: null,

  setName: (name) => set({ name }),
  setVisibility: (visibility) => set({ visibility }),

  addStep: (step) => set((state) => ({ steps: [...state.steps, step] })),

  updateStep: (id, data) =>
    set((state) => ({
      steps: state.steps.map((s) => (s.id === id ? { ...s, ...data } : s)),
    })),

  removeStep: (id) =>
    set((state) => ({
      steps: state.steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i })),
    })),

  reorderSteps: (fromIndex, toIndex) =>
    set((state) => {
      const steps = [...state.steps]
      const [moved] = steps.splice(fromIndex, 1)
      steps.splice(toIndex, 0, moved)
      return { steps: steps.map((s, i) => ({ ...s, order: i })) }
    }),

  setEditingId: (editingId) => set({ editingId }),

  loadFromExisting: (launcher) =>
    set({
      name: launcher.name,
      visibility: launcher.visibility as 'private' | 'public',
      steps: (launcher.steps as DraftStep[]) || [],
    }),

  reset: () => set({ name: '', visibility: 'private', steps: [], editingId: null }),
}))
