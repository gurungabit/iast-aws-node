import { useEffect, type ReactNode } from 'react'
import { useSessionStore } from '../stores/session-store'
import { useASTStore } from '../stores/ast-store'
import type { ServerMessage } from '../services/websocket'

export function ASTEventBridge({ children }: { children: ReactNode }) {
  const tabs = useSessionStore((s) => s.tabs)
  const {
    startExecution,
    updateStatus,
    updateProgress,
    addItemBatch,
    completeExecution,
  } = useASTStore()

  useEffect(() => {
    const cleanups: (() => void)[] = []

    for (const [sessionId, tab] of tabs) {
      if (!tab.ws) continue

      const cleanup = tab.ws.onMessage((msg: ServerMessage) => {
        switch (msg.type) {
          case 'ast.status':
            if (msg.status === 'running' && msg.executionId) {
              startExecution(sessionId, msg.executionId, msg.astName)
            } else {
              updateStatus(sessionId, msg.status as 'running' | 'paused')
            }
            break
          case 'ast.progress':
            updateProgress(sessionId, msg.progress)
            break
          case 'ast.item_result_batch':
            addItemBatch(sessionId, msg.items)
            break
          case 'ast.complete':
            completeExecution(
              sessionId,
              msg.status as 'completed' | 'failed' | 'cancelled',
              msg.error,
            )
            break
        }
      })

      cleanups.push(cleanup)
    }

    return () => cleanups.forEach((fn) => fn())
  }, [tabs, startExecution, updateStatus, updateProgress, addItemBatch, completeExecution])

  return <>{children}</>
}
