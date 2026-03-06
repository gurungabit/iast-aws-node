import { create } from 'zustand'
import type { ASTItemResult } from '../services/websocket'

export type ASTStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

interface ASTExecution {
  executionId: string
  astName: string
  status: ASTStatus
  progress: { current: number; total: number; message: string }
  items: ASTItemResult[]
  error?: string
}

interface ASTState {
  // Per-session AST execution state
  executions: Map<string, ASTExecution>

  startExecution: (sessionId: string, executionId: string, astName: string) => void
  updateStatus: (sessionId: string, status: ASTStatus) => void
  updateProgress: (sessionId: string, progress: ASTExecution['progress']) => void
  addItemBatch: (sessionId: string, items: ASTItemResult[]) => void
  completeExecution: (sessionId: string, status: ASTStatus, error?: string) => void
  clearExecution: (sessionId: string) => void
  getExecution: (sessionId: string) => ASTExecution | null
}

export const useASTStore = create<ASTState>((set, get) => ({
  executions: new Map(),

  startExecution: (sessionId, executionId, astName) => {
    set((state) => {
      const executions = new Map(state.executions)
      executions.set(sessionId, {
        executionId,
        astName,
        status: 'running',
        progress: { current: 0, total: 0, message: 'Starting...' },
        items: [],
      })
      return { executions }
    })
  },

  updateStatus: (sessionId, status) => {
    set((state) => {
      const executions = new Map(state.executions)
      const exec = executions.get(sessionId)
      if (exec) executions.set(sessionId, { ...exec, status })
      return { executions }
    })
  },

  updateProgress: (sessionId, progress) => {
    set((state) => {
      const executions = new Map(state.executions)
      const exec = executions.get(sessionId)
      if (exec) executions.set(sessionId, { ...exec, progress })
      return { executions }
    })
  },

  addItemBatch: (sessionId, items) => {
    set((state) => {
      const executions = new Map(state.executions)
      const exec = executions.get(sessionId)
      if (exec) {
        executions.set(sessionId, {
          ...exec,
          items: [...exec.items, ...items],
        })
      }
      return { executions }
    })
  },

  completeExecution: (sessionId, status, error) => {
    set((state) => {
      const executions = new Map(state.executions)
      const exec = executions.get(sessionId)
      if (exec) executions.set(sessionId, { ...exec, status, error })
      return { executions }
    })
  },

  clearExecution: (sessionId) => {
    set((state) => {
      const executions = new Map(state.executions)
      executions.delete(sessionId)
      return { executions }
    })
  },

  getExecution: (sessionId) => get().executions.get(sessionId) ?? null,
}))
