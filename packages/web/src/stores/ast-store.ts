import { create } from 'zustand'
import type { ASTStatus, ASTResult, ASTProgress, ASTItemResult } from '../ast/types'

// AutoLauncher run types
export type AutoLauncherRunStatus = 'running' | 'completed' | 'failed'
export type AutoLauncherStepStatus = 'pending' | 'running' | 'success' | 'failed'
export type AutoLauncherRunSource = 'autoLauncher' | 'multiTaskConfig'

export interface AutoLauncherStepState {
  astName: string
  configId: string
  order: number
  status: AutoLauncherStepStatus
  error?: string
  stepLabel?: string
  taskLabel?: string | null
  configName?: string
  startedAt?: number
  completedAt?: number
}

export interface AutoLauncherRunState {
  runId: string
  launcherId: string
  status: AutoLauncherRunStatus
  nextStepIndex: number
  steps: AutoLauncherStepState[]
  lastError?: string
  source: AutoLauncherRunSource
  displayName?: string
  startedAt?: number
  completedAt?: number
}

// Tab state
export interface TabASTState {
  selectedASTId: string | null
  runningAST: string | null
  executionId: string | null
  status: ASTStatus
  lastResult: ASTResult | null
  progress: ASTProgress | null
  itemResults: ASTItemResult[]
  statusMessages: string[]
  autoLauncherRun: AutoLauncherRunState | null
  credentials: { username: string; password: string }
  formOptions: { testMode: boolean; parallel: boolean }
  customFields: Record<string, unknown>
  startedAt: number | null
}

function createDefaultTabState(): TabASTState {
  return {
    selectedASTId: null,
    runningAST: null,
    executionId: null,
    status: 'idle',
    lastResult: null,
    progress: null,
    itemResults: [],
    statusMessages: [],
    autoLauncherRun: null,
    credentials: { username: '', password: '' },
    formOptions: { testMode: false, parallel: false },
    customFields: {},
    startedAt: null,
  }
}

interface ASTStore {
  tabs: Record<string, TabASTState>
  activeTabId: string | null

  setActiveTabId: (tabId: string | null) => void
  initTab: (tabId: string) => void
  removeTab: (tabId: string) => void
  setSelectedASTId: (tabId: string, astId: string | null) => void
  setCredentials: (tabId: string, credentials: { username?: string; password?: string }) => void
  setFormOptions: (tabId: string, options: { testMode?: boolean; parallel?: boolean }) => void
  setCustomField: (tabId: string, key: string, value: unknown) => void

  // Execution
  executeAST: (tabId: string, astName: string, params?: Record<string, unknown>) => void
  resumeAST: (
    tabId: string,
    astName: string,
    resumeExecutionId: string,
    params: Record<string, unknown>,
  ) => void
  handleASTStatus: (
    tabId: string,
    info: {
      astName: string
      status: ASTStatus
      executionId?: string
      message?: string
      error?: string
      duration?: number
    },
  ) => void
  handleASTProgress: (tabId: string, progress: ASTProgress) => void
  handleASTItemResults: (tabId: string, items: ASTItemResult[]) => void
  handleASTComplete: (tabId: string, result: ASTResult) => void
  addStatusMessage: (tabId: string, message: string) => void
  clearLogs: (tabId: string) => void

  // AutoLauncher
  beginAutoLauncherRun: (
    tabId: string,
    config: {
      runId: string
      launcherId: string
      steps: Array<{
        astName: string
        configId: string
        order: number
        stepLabel?: string
        taskLabel?: string | null
        configName?: string
      }>
      source?: AutoLauncherRunSource
      displayName?: string
    },
  ) => void
  clearAutoLauncherRun: (tabId: string) => void
}

export const useASTStore = create<ASTStore>((set) => ({
  tabs: {},
  activeTabId: null,

  setActiveTabId: (tabId) => set({ activeTabId: tabId }),

  initTab: (tabId) =>
    set((state) => {
      if (state.tabs[tabId]) return state
      return { tabs: { ...state.tabs, [tabId]: createDefaultTabState() } }
    }),

  removeTab: (tabId) =>
    set((state) => {
      const { [tabId]: _, ...rest } = state.tabs
      return { tabs: rest }
    }),

  setSelectedASTId: (tabId, astId) =>
    set((state) => {
      const tab = state.tabs[tabId]
      if (!tab) return state
      return { tabs: { ...state.tabs, [tabId]: { ...tab, selectedASTId: astId } } }
    }),

  setCredentials: (tabId, creds) =>
    set((state) => {
      const tab = state.tabs[tabId]
      if (!tab) return state
      return {
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, credentials: { ...tab.credentials, ...creds } },
        },
      }
    }),

  setFormOptions: (tabId, opts) =>
    set((state) => {
      const tab = state.tabs[tabId]
      if (!tab) return state
      return {
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, formOptions: { ...tab.formOptions, ...opts } },
        },
      }
    }),

  setCustomField: (tabId, key, value) =>
    set((state) => {
      const tab = state.tabs[tabId]
      if (!tab) return state
      return {
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, customFields: { ...tab.customFields, [key]: value } },
        },
      }
    }),

  executeAST: (tabId, astName, params) => {
    set((state) => {
      const tab = state.tabs[tabId]
      if (!tab) return state
      return {
        tabs: {
          ...state.tabs,
          [tabId]: {
            ...tab,
            runningAST: astName,
            status: 'running',
            lastResult: null,
            progress: null,
            itemResults: [],
            statusMessages: [`Starting ${astName}...`],
            startedAt: Date.now(),
          },
        },
      }
    })

    // Send via WebSocket if available
    const sessionStore = (window as unknown as Record<string, unknown>).__sessionStoreRef as
      | { getState: () => { tabs: Map<string, { ws?: { send: (msg: unknown) => void } }> } }
      | undefined
    if (sessionStore) {
      const tab = sessionStore.getState().tabs.get(tabId)
      tab?.ws?.send({ type: 'ast.run', astName, params })
    }
  },

  resumeAST: (tabId, astName, resumeExecutionId, params) => {
    set((state) => {
      const tab = state.tabs[tabId]
      if (!tab) return state
      return {
        tabs: {
          ...state.tabs,
          [tabId]: {
            ...tab,
            runningAST: astName,
            status: 'running',
            lastResult: null,
            progress: null,
            itemResults: [],
            statusMessages: [`Resuming ${astName} from previous execution...`],
            startedAt: Date.now(),
          },
        },
      }
    })

    const sessionStore = (window as unknown as Record<string, unknown>).__sessionStoreRef as
      | { getState: () => { tabs: Map<string, { ws?: { send: (msg: unknown) => void } }> } }
      | undefined
    if (sessionStore) {
      const tab = sessionStore.getState().tabs.get(tabId)
      tab?.ws?.send({ type: 'ast.run', astName, params, resumeExecutionId })
    }
  },

  handleASTStatus: (tabId, info) =>
    set((state) => {
      const tab = state.tabs[tabId]
      if (!tab) return state

      const updates: Partial<TabASTState> = { status: info.status }
      if (info.status === 'running' || info.status === 'paused') {
        if (info.astName) updates.runningAST = info.astName
        if (info.executionId) updates.executionId = info.executionId
      }
      if (info.message) {
        updates.statusMessages = [...tab.statusMessages, info.message]
      }

      // Handle AutoLauncher step tracking
      if (tab.autoLauncherRun) {
        const run = { ...tab.autoLauncherRun }
        const steps = [...run.steps]
        const currentIdx = run.nextStepIndex

        if (info.status === 'running' && currentIdx < steps.length) {
          steps[currentIdx] = { ...steps[currentIdx], status: 'running', startedAt: Date.now() }
        } else if (info.status === 'completed' && currentIdx < steps.length) {
          steps[currentIdx] = { ...steps[currentIdx], status: 'success' }
          run.nextStepIndex = currentIdx + 1
          if (run.nextStepIndex >= steps.length) {
            run.status = 'completed'
          }
        } else if (info.status === 'failed' && currentIdx < steps.length) {
          steps[currentIdx] = { ...steps[currentIdx], status: 'failed', error: info.error }
          run.status = 'failed'
          run.lastError = info.error
        }

        run.steps = steps
        updates.autoLauncherRun = run
      }

      return {
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, ...updates },
        },
      }
    }),

  handleASTProgress: (tabId, progress) =>
    set((state) => {
      const tab = state.tabs[tabId]
      if (!tab) return state
      return { tabs: { ...state.tabs, [tabId]: { ...tab, progress } } }
    }),

  handleASTItemResults: (tabId, items) =>
    set((state) => {
      const tab = state.tabs[tabId]
      if (!tab) return state
      return {
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, itemResults: [...tab.itemResults, ...items] },
        },
      }
    }),

  handleASTComplete: (tabId, result) =>
    set((state) => {
      const tab = state.tabs[tabId]
      if (!tab) return state
      const duration = tab.startedAt ? (Date.now() - tab.startedAt) / 1000 : undefined
      const resultWithDuration = { ...result, duration: result.duration ?? duration }

      // AutoLauncher step tracking: advance the current step
      let autoLauncherRun = tab.autoLauncherRun
      let keepRunning = false
      if (autoLauncherRun) {
        const run = { ...autoLauncherRun }
        const steps = [...run.steps]
        const idx = run.nextStepIndex

        if (idx < steps.length) {
          const now = Date.now()
          if (result.status === 'completed') {
            steps[idx] = { ...steps[idx], status: 'success', completedAt: now }
            run.nextStepIndex = idx + 1
            if (run.nextStepIndex >= steps.length) {
              run.status = 'completed'
              run.completedAt = now
            } else {
              // More steps to go — keep tab status as 'running'
              keepRunning = true
            }
          } else if (result.status === 'failed' || result.status === 'cancelled') {
            steps[idx] = {
              ...steps[idx],
              status: 'failed',
              error: result.message,
              completedAt: now,
            }
            run.status = 'failed'
            run.completedAt = now
            run.lastError = result.message
          }
        }

        run.steps = steps
        autoLauncherRun = run
      }

      return {
        tabs: {
          ...state.tabs,
          [tabId]: {
            ...tab,
            status: keepRunning ? 'running' : result.status,
            runningAST: keepRunning ? tab.runningAST : null,
            lastResult: keepRunning ? null : resultWithDuration,
            progress: keepRunning ? null : tab.progress,
            startedAt: keepRunning ? tab.startedAt : null,
            autoLauncherRun,
            statusMessages: [
              ...tab.statusMessages,
              result.message || `Completed with status: ${result.status}`,
            ],
          },
        },
      }
    }),

  addStatusMessage: (tabId, message) =>
    set((state) => {
      const tab = state.tabs[tabId]
      if (!tab) return state
      return {
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, statusMessages: [...tab.statusMessages, message] },
        },
      }
    }),

  clearLogs: (tabId) =>
    set((state) => {
      const tab = state.tabs[tabId]
      if (!tab) return state
      return {
        tabs: {
          ...state.tabs,
          [tabId]: {
            ...tab,
            statusMessages: [],
            itemResults: [],
            progress: null,
            lastResult: null,
            status: 'idle',
            executionId: null,
          },
        },
      }
    }),

  beginAutoLauncherRun: (tabId, config) =>
    set((state) => {
      const tab = state.tabs[tabId]
      if (!tab) return state
      const run: AutoLauncherRunState = {
        runId: config.runId,
        launcherId: config.launcherId,
        status: 'running',
        nextStepIndex: 0,
        startedAt: Date.now(),
        steps: config.steps.map((s) => ({
          astName: s.astName,
          configId: s.configId,
          order: s.order,
          status: 'pending' as const,
          stepLabel: s.stepLabel,
          taskLabel: s.taskLabel,
          configName: s.configName,
        })),
        source: config.source ?? 'autoLauncher',
        displayName: config.displayName,
      }
      return {
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, autoLauncherRun: run },
        },
      }
    }),

  clearAutoLauncherRun: (tabId) =>
    set((state) => {
      const tab = state.tabs[tabId]
      if (!tab) return state
      return {
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, autoLauncherRun: null },
        },
      }
    }),
}))
