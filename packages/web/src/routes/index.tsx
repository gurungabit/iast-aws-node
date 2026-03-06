import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../stores/session-store'
import { SessionSelector } from '../terminal/SessionSelector'
import { TerminalComponent } from '../terminal/Terminal'
import { ASTPanel } from '../ast/components/ASTPanel'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { getSessions, createSession } from '../services/sessions'
import { TerminalWebSocket } from '../services/websocket'

export const Route = createFileRoute('/')({
  component: TerminalPage,
})

function TerminalPage() {
  const activeTabId = useSessionStore((s) => s.activeTabId)
  const tab = useSessionStore((s) => (s.activeTabId ? s.tabs.get(s.activeTabId) : null))
  const [loaded, setLoaded] = useState(false)
  const initRef = useRef(false)

  const { addTab, setWs, setActiveTab } = useSessionStore()

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
          const ws = new TerminalWebSocket(s.id)
          await ws.connect()
          setWs(s.id, ws)
        }

        const activeId = sessions.find((s) => s.id === stored)?.id ?? sessions[0].id
        setActiveTab(activeId)
        localStorage.setItem('iast-active-session', activeId)
      } catch (err) {
        console.error('Failed to initialize sessions:', err)
      } finally {
        setLoaded(true)
      }
    }

    init()
  }, [addTab, setWs, setActiveTab])

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-gray-500 dark:text-zinc-400">Loading sessions...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <SessionSelector />
      {activeTabId && tab ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Terminal area */}
          <div className="flex flex-1 flex-col">
            {!tab.connected && (
              <ConnectBar sessionId={activeTabId} />
            )}
            <div className="flex-1">
              <TerminalComponent sessionId={activeTabId} />
            </div>
          </div>

          {/* AST panel sidebar */}
          <div className="w-80 border-l border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900">
            <ASTPanel sessionId={activeTabId} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 dark:text-zinc-400">No session open</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-zinc-600">Click + to create a new session</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ConnectBar({ sessionId }: { sessionId: string }) {
  const tab = useSessionStore((s) => s.tabs.get(sessionId))
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState('3270')

  const handleConnect = () => {
    tab?.ws?.send({ type: 'connect', host, port: parseInt(port) })
  }

  return (
    <div className="flex items-center gap-2 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 px-3 py-2">
      <Input
        value={host}
        onChange={(e) => setHost(e.target.value)}
        placeholder="Host"
        className="w-48"
      />
      <Input
        value={port}
        onChange={(e) => setPort(e.target.value)}
        placeholder="Port"
        className="w-20"
      />
      <Button size="sm" onClick={handleConnect}>
        Connect
      </Button>
    </div>
  )
}
