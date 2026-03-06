import { useCallback } from 'react'
import { useSessionStore } from '../stores/session-store'
import { useASTStore } from '../stores/ast-store'

export function useAST(sessionId: string | null) {
  const runAST = useCallback(
    (astName: string, params: Record<string, unknown>, configId?: string) => {
      if (!sessionId) return
      const tab = useSessionStore.getState().tabs.get(sessionId)
      if (!tab?.ws) return

      tab.ws.send({
        type: 'ast.run',
        astName,
        params,
        configId,
      })
    },
    [sessionId],
  )

  const controlAST = useCallback(
    (action: 'pause' | 'resume' | 'cancel') => {
      if (!sessionId) return
      const tab = useSessionStore.getState().tabs.get(sessionId)
      tab?.ws?.send({ type: 'ast.control', action })
    },
    [sessionId],
  )

  const execution = useASTStore(
    (s) => (sessionId ? s.executions.get(sessionId) ?? null : null),
  )

  return { runAST, controlAST, execution }
}
