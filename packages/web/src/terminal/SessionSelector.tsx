import { useState } from 'react'
import { useSessionStore } from '../stores/session-store'
import { createSession } from '../services/sessions'
import { TerminalWebSocket } from '../services/websocket'
import { cn } from '../utils'

export function SessionSelector() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, setWs } = useSessionStore()
  const [creating, setCreating] = useState(false)

  const handleNewTab = async () => {
    setCreating(true)
    try {
      const session = await createSession()
      addTab(session.id, session.name || `Session ${tabs.size + 1}`)

      // Create and connect WebSocket
      const ws = new TerminalWebSocket(session.id)
      await ws.connect()
      setWs(session.id, ws)
    } catch (err) {
      console.error('Failed to create session:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleClose = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    removeTab(sessionId)
  }

  return (
    <div className="flex items-center gap-1 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 px-2 min-h-10">
      {Array.from(tabs.values()).map((tab) => (
        <button
          key={tab.sessionId}
          onClick={() => setActiveTab(tab.sessionId)}
          className={cn(
            'group flex items-center gap-2 rounded-t px-3 py-2 text-sm transition-colors cursor-pointer',
            activeTabId === tab.sessionId
              ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100'
              : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 dark:hover:text-zinc-200',
          )}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              tab.connected ? 'bg-green-500' : 'bg-gray-400 dark:bg-zinc-600',
            )}
          />
          <span>{tab.name || tab.sessionId.slice(0, 8)}</span>
          <span
            onClick={(e) => handleClose(e, tab.sessionId)}
            className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-500 cursor-pointer"
          >
            &times;
          </span>
        </button>
      ))}
      <button
        onClick={handleNewTab}
        disabled={creating}
        className="ml-1 flex items-center justify-center rounded h-7 w-7 text-sm font-medium text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        title="New session"
      >
        +
      </button>
    </div>
  )
}
