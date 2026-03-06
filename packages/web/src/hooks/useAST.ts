import { useCallback } from 'react'
import { useASTStore } from '../stores/ast-store'
import { useSessionStore } from '../stores/session-store'

export function useAST() {
  const activeTabId = useASTStore((s) => s.activeTabId)
  const tabState = useASTStore((s) => (activeTabId ? s.tabs[activeTabId] ?? null : null))

  const status = tabState?.status ?? 'idle'
  const isRunning = status === 'running' || status === 'paused'
  const lastResult = tabState?.lastResult ?? null
  const progress = tabState?.progress ?? null
  const itemResults = tabState?.itemResults ?? []
  const statusMessages = tabState?.statusMessages ?? []

  const executeAST = useCallback(
    (astName: string, params?: Record<string, unknown>) => {
      if (!activeTabId) return

      // Send via WebSocket
      const tab = useSessionStore.getState().tabs.get(activeTabId)
      if (tab?.ws) {
        tab.ws.send({ type: 'ast.run', astName, params })
      }

      // Update store
      useASTStore.getState().executeAST(activeTabId, astName, params)
    },
    [activeTabId],
  )

  const controlAST = useCallback(
    (action: 'pause' | 'resume' | 'cancel') => {
      if (!activeTabId) return
      const tab = useSessionStore.getState().tabs.get(activeTabId)
      tab?.ws?.send({ type: 'ast.control', action })
    },
    [activeTabId],
  )

  const clearLogs = useCallback(() => {
    if (!activeTabId) return
    useASTStore.getState().clearLogs(activeTabId)
  }, [activeTabId])

  return {
    status,
    isRunning,
    lastResult,
    progress,
    itemResults,
    statusMessages,
    executeAST,
    controlAST,
    clearLogs,
  }
}
