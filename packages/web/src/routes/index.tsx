import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../stores/session-store'
import { useASTStore } from '../stores/ast-store'
import { TerminalComponent } from '../terminal/Terminal'
import { ASTPanel } from '../ast/components/ASTPanel'
import { getSessions, createSession, deleteSession, renameSession } from '../services/sessions'
import { TerminalWebSocket } from '../services/websocket'

export const Route = createFileRoute('/')({
  component: TerminalPage,
})

function TerminalPage() {
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)
  const [loaded, setLoaded] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const initRef = useRef(false)

  const { addTab, removeTab, setWs, setActiveTab, renameTab } = useSessionStore()
  const { initTab: initASTTab, removeTab: removeASTTab, setActiveTabId: setASTActiveTab } = useASTStore()

  // Auto-load existing sessions or create one on mount
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const init = async () => {
      try {
        let sessions = await getSessions()

        if (sessions.length === 0) {
          const newSession = await createSession('Terminal')
          sessions = [newSession]
        }

        const stored = localStorage.getItem('iast-active-session')

        for (const s of sessions) {
          addTab(s.id, s.name || `Session ${s.id.slice(0, 6)}`)
          initASTTab(s.id)
          try {
            const ws = new TerminalWebSocket(s.id)
            await ws.connect()
            setWs(s.id, ws)
          } catch (err) {
            console.error(`Failed to connect WS for session ${s.id}:`, err)
          }
        }

        const activeId = sessions.find((s) => s.id === stored)?.id ?? sessions[0].id
        setActiveTab(activeId)
        setASTActiveTab(activeId)
        localStorage.setItem('iast-active-session', activeId)
      } catch (err) {
        console.error('Failed to initialize sessions:', err)
      } finally {
        setLoaded(true)
      }
    }

    init()
  }, [addTab, setWs, setActiveTab, initASTTab, setASTActiveTab])

  const handleAddTab = async () => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const session = await createSession(`Session ${tabs.size + 1}`)
      addTab(session.id, session.name || `Session ${tabs.size + 1}`)
      initASTTab(session.id)
      const ws = new TerminalWebSocket(session.id)
      await ws.connect()
      setWs(session.id, ws)
      setActiveTab(session.id)
      setASTActiveTab(session.id)
      localStorage.setItem('iast-active-session', session.id)
    } catch (err) {
      console.error('Failed to create session:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleCloseTab = async (tabId: string) => {
    // Disconnect WS before removing
    const tab = tabs.get(tabId)
    tab?.ws?.disconnect()

    removeTab(tabId)
    removeASTTab(tabId)

    // Delete from server
    deleteSession(tabId).catch((err) =>
      console.error('Failed to delete session:', err),
    )

    const remaining = Array.from(tabs.keys()).filter((id) => id !== tabId)
    if (remaining.length > 0) {
      const nextId = remaining[0]
      setActiveTab(nextId)
      setASTActiveTab(nextId)
      localStorage.setItem('iast-active-session', nextId)
    }
  }

  const handleSwitchTab = (tabId: string) => {
    setActiveTab(tabId)
    setASTActiveTab(tabId)
    localStorage.setItem('iast-active-session', tabId)
  }

  const handleStartEdit = (tabId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTabId(tabId)
    setEditName(currentName)
  }

  const handleSaveEdit = (tabId: string) => {
    const name = editName.trim()
    if (name) {
      renameTab(tabId, name)
      renameSession(tabId, name).catch((err) =>
        console.error('Failed to rename session:', err),
      )
    }
    setEditingTabId(null)
    setEditName('')
  }

  if (!loaded) {
    return (
      <main className="flex-1 overflow-hidden flex flex-col p-4 gap-4 bg-white dark:bg-zinc-950">
        <div className="flex items-center justify-center h-32">
          <div className="text-sm text-gray-500 dark:text-zinc-400">Loading sessions...</div>
        </div>
      </main>
    )
  }

  const tabsArray = Array.from(tabs.values())

  return (
    <main className="flex-1 min-h-0 overflow-hidden overscroll-none flex flex-col bg-white dark:bg-zinc-950">
      {/* Tab bar */}
      <div className="flex items-stretch h-9 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        {tabsArray.map((tab) => (
          <div
            key={tab.sessionId}
            className={`group relative shrink-0 flex items-center gap-2 px-4 text-sm ${
              editingTabId === tab.sessionId ? '' : 'cursor-pointer'
            } select-none border-r border-zinc-200 dark:border-zinc-800 ${
              tab.sessionId === activeTabId
                ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
            onClick={() => editingTabId !== tab.sessionId && handleSwitchTab(tab.sessionId)}
          >
            {editingTabId === tab.sessionId ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(tab.sessionId)
                    if (e.key === 'Escape') { setEditingTabId(null); setEditName('') }
                  }}
                  onBlur={() => handleSaveEdit(tab.sessionId)}
                  className="px-1 py-0.5 text-sm border rounded bg-white dark:bg-zinc-800 dark:border-zinc-600 min-w-[80px] max-w-[160px]"
                  autoFocus
                />
              </div>
            ) : (
              <span
                className="whitespace-nowrap"
                onDoubleClick={(e) => handleStartEdit(tab.sessionId, tab.name, e)}
                title="Double-click to rename"
              >
                {tab.name || tab.sessionId.slice(0, 8)}
              </span>
            )}
            {tabsArray.length > 1 && editingTabId !== tab.sessionId && (
              <button
                className="w-4 h-4 flex items-center justify-center rounded
                  opacity-60 hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer
                  text-zinc-500 dark:text-zinc-400"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCloseTab(tab.sessionId)
                }}
                aria-label="Close tab"
                title="Close tab"
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
              </button>
            )}
          </div>
        ))}
        <button
          className="shrink-0 flex items-center gap-2 px-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          onClick={handleAddTab}
          disabled={isCreating}
          aria-label="New session"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 3v10M3 8h10" />
          </svg>
          <span className="text-sm whitespace-nowrap">
            {isCreating ? 'Creating...' : 'New Session'}
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col gap-4 p-4">
        {tabsArray.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-sm text-gray-500 dark:text-zinc-400">
              No sessions available. Click + to create one.
            </div>
          </div>
        ) : activeTabId ? (
          <div className="flex-1 flex flex-row gap-4 min-h-0 overflow-x-auto">
            {/* Terminal - shrink-0 keeps natural width */}
            <div className="shrink-0">
              <TerminalComponent sessionId={activeTabId} />
            </div>

            {/* AST Panel - flex-1 fills remaining space */}
            <div className="flex-1 min-w-0 overflow-auto overscroll-contain">
              <ASTPanel />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
