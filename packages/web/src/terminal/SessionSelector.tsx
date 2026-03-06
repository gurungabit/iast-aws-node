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
    <div className="flex items-center gap-0.5 border-b border-gray-800 bg-gray-950 px-2">
      {Array.from(tabs.values()).map((tab) => (
        <button
          key={tab.sessionId}
          onClick={() => setActiveTab(tab.sessionId)}
          className={cn(
            'group flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs transition-colors',
            activeTabId === tab.sessionId
              ? 'bg-gray-900 text-white'
              : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              tab.connected ? 'bg-green-400' : 'bg-gray-600',
            )}
          />
          <span>{tab.name || tab.sessionId.slice(0, 8)}</span>
          <span
            onClick={(e) => handleClose(e, tab.sessionId)}
            className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-400"
          >
            &times;
          </span>
        </button>
      ))}
      <button
        onClick={handleNewTab}
        disabled={creating}
        className="ml-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-300 disabled:opacity-50"
      >
        +
      </button>
    </div>
  )
}
