import { useEffect } from 'react'
import { useSessionStore } from '../stores/session-store'
import { useASTStore } from '../stores/ast-store'
import type { ServerMessage } from '../services/websocket'

export function ASTEventBridge(): React.ReactNode {
  const tabs = useSessionStore((s) => s.tabs)

  useEffect(() => {
    const cleanups: (() => void)[] = []

    for (const [tabId, tab] of tabs) {
      if (!tab.ws) continue

      const cleanup = tab.ws.onMessage((msg: ServerMessage) => {
        switch (msg.type) {
          case 'ast.status': {
            const mappedStatus = msg.status === 'pending' ? 'running' : msg.status
            useASTStore.getState().addStatusMessage(tabId, `[${msg.astName}] ${mappedStatus}`)
            useASTStore.getState().handleASTStatus(tabId, {
              astName: msg.astName,
              status: mappedStatus as 'running' | 'paused' | 'completed' | 'failed' | 'cancelled',
            })
            break
          }
          case 'ast.progress': {
            const progressData = {
              current: msg.progress.current,
              total: msg.progress.total,
              message: msg.progress.message,
              percentage:
                msg.progress.total > 0
                  ? Math.round((msg.progress.current / msg.progress.total) * 100)
                  : 0,
            }
            useASTStore.getState().handleASTProgress(tabId, progressData)
            if (msg.progress.message) {
              useASTStore.getState().addStatusMessage(tabId, msg.progress.message)
            }
            break
          }
          case 'ast.item_result_batch':
            useASTStore.getState().handleASTItemResults(tabId, msg.items)
            break
          case 'ast.complete':
            useASTStore.getState().handleASTComplete(tabId, {
              status: msg.status as 'completed' | 'failed' | 'cancelled',
              message: msg.error,
            })
            break
        }
      })

      cleanups.push(cleanup)
    }

    return () => cleanups.forEach((fn) => fn())
  }, [tabs])

  return null
}
