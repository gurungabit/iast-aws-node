import { useEffect, useState, useRef, memo } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { config } from '../config'
import { useSessionStore } from '../stores/session-store'
import type { ServerMessage } from '../services/websocket'

interface TerminalProps {
  sessionId: string
}

const PF_KEYS = [
  'PF1', 'PF2', 'PF3', 'PF4', 'PF5', 'PF6',
  'PF7', 'PF8', 'PF9', 'PF10', 'PF11', 'PF12',
  'PF13', 'PF14', 'PF15', 'PF16', 'PF17', 'PF18',
  'PF19', 'PF20', 'PF21', 'PF22', 'PF23', 'PF24',
]

const PA_KEYS = [
  { label: 'PA1', key: 'pa1' },
  { label: 'PA2', key: 'pa2' },
  { label: 'PA3', key: 'pa3' },
  { label: 'Clear', key: 'clear' },
  { label: 'Attn', key: 'attn' },
  { label: 'Enter', key: 'enter' },
]

const KEYBOARD_SHORTCUTS = [
  { keys: 'F1-F12', action: 'PF1-PF12' },
  { keys: 'Shift+F1-F12', action: 'PF13-PF24' },
  { keys: 'Ctrl+C', action: 'PA1' },
  { keys: 'Ctrl+R', action: 'Reset' },
  { keys: 'Enter', action: 'Enter/Submit' },
  { keys: 'Tab', action: 'Next Field' },
  { keys: 'Home', action: 'Field Start' },
  { keys: 'End', action: 'Field End' },
  { keys: 'Delete', action: 'Delete Char' },
  { keys: 'Backspace', action: 'Backspace' },
]

function getStatusColor(connected: boolean): string {
  return connected ? '#0dbc79' : '#666666'
}

export const TerminalComponent = memo(function TerminalComponent({ sessionId }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const tab = useSessionStore((s) => s.tabs.get(sessionId))
  const updateScreen = useSessionStore((s) => s.updateScreen)
  const setConnected = useSessionStore((s) => s.setConnected)

  const [keyMenuOpen, setKeyMenuOpen] = useState(false)

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setKeyMenuOpen(false)
      }
    }
    if (keyMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [keyMenuOpen])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !tab?.ws) return

    const ws = tab.ws

    const term = new XTerm({
      rows: config.terminal.rows,
      cols: config.terminal.cols,
      fontSize: config.terminal.fontSize,
      fontFamily: config.terminal.fontFamily,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 0,
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#00ff00',
      },
    })

    term.open(container)
    termRef.current = term
    term.focus()

    // Intercept Ctrl+C (copy), Ctrl+V/Cmd+V (paste) before xterm processes them
    term.attachCustomKeyEventHandler((ev: KeyboardEvent) => {
      // Allow browser copy
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'c') return false
      // Handle paste via clipboard API
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'v') {
        if (ev.type === 'keydown') {
          navigator.clipboard.readText().then((text) => {
            if (text) ws.send({ type: 'data', text })
          }).catch(() => {})
        }
        return false
      }
      return true
    })

    // Handle all keyboard input
    term.onKey(({ domEvent: ev }) => {
      // Prevent browser defaults for terminal keys
      if (ev.key === 'Tab' || ev.key === 'Backspace' || ev.key === 'Enter'
        || ev.key.startsWith('Arrow') || ev.key.startsWith('F')
        || ev.key === 'Home' || ev.key === 'End' || ev.key === 'Delete'
        || ev.key === 'Escape') {
        ev.preventDefault()
      }

      // Ctrl shortcuts
      if (ev.ctrlKey) {
        if (ev.key === 'c') { ws.send({ type: 'key', key: 'pa1' }); return }
        if (ev.key === 'r') { ws.send({ type: 'key', key: 'reset' }); return }
      }

      // F-keys (Shift+F1-F12 → PF13-PF24)
      const fMatch = ev.key.match(/^F(\d+)$/)
      if (fMatch) {
        const n = parseInt(fMatch[1]!, 10)
        if (n >= 1 && n <= 24) {
          ws.send({ type: 'key', key: `pf${n}` })
        }
        return
      }

      // Special keys
      switch (ev.key) {
        case 'Enter': ws.send({ type: 'key', key: 'enter' }); return
        case 'Escape': ws.send({ type: 'key', key: 'reset' }); return
        case 'Tab': ws.send({ type: 'key', key: ev.shiftKey ? 'keyBacktab' : 'keyTab' }); return
        case 'Backspace': ws.send({ type: 'key', key: 'keyBackspace' }); return
        case 'Delete': ws.send({ type: 'key', key: 'keyDelete' }); return
        case 'Home': ws.send({ type: 'key', key: 'keyHome' }); return
        case 'End': ws.send({ type: 'key', key: 'keyEnd' }); return
        case 'ArrowUp': ws.send({ type: 'key', key: 'keyCurUp' }); return
        case 'ArrowDown': ws.send({ type: 'key', key: 'keyCurDown' }); return
        case 'ArrowLeft': ws.send({ type: 'key', key: 'keyCurLeft' }); return
        case 'ArrowRight': ws.send({ type: 'key', key: 'keyCurRight' }); return
      }

      // Regular character typing
      if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        ws.send({ type: 'data', text: ev.key })
      }
    })

    // Mouse click for cursor positioning
    const handleMouse = (e: MouseEvent) => {
      const screen = container.querySelector('.xterm-screen')
      if (!screen) return

      const rect = screen.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return

      const cellWidth = rect.width / config.terminal.cols
      const cellHeight = rect.height / config.terminal.rows
      const col = Math.min(Math.floor(x / cellWidth) + 1, config.terminal.cols)
      const row = Math.min(Math.floor(y / cellHeight) + 1, config.terminal.rows)

      ws.send({ type: 'cursor', row, col })
      term.focus()
    }

    // Right-click paste: listen on xterm's internal textarea (capture phase)
    const handlePaste = (e: Event) => {
      const clipboardEvent = e as ClipboardEvent
      const text = clipboardEvent.clipboardData?.getData('text')
      if (text) {
        ws.send({ type: 'data', text })
        e.preventDefault()
        e.stopPropagation()
      }
    }

    // Attach DOM listeners after xterm renders
    setTimeout(() => {
      if (term.element) {
        term.element.addEventListener('mousedown', handleMouse)
      }
      const xtermTextarea = container.querySelector('.xterm-helper-textarea')
      if (xtermTextarea) {
        xtermTextarea.addEventListener('paste', handlePaste, true)
      }
    }, 100)

    // Listen for server messages
    const messageCleanup = ws.onMessage((msg: ServerMessage) => {
      if (msg.type === 'screen') {
        term.write(msg.ansi)
        updateScreen(sessionId, msg.ansi, msg.meta)
      } else if (msg.type === 'connected') {
        setConnected(sessionId, true)
      } else if (msg.type === 'disconnected') {
        setConnected(sessionId, false)
      }
    })

    // Auto-connect to mainframe
    ws.send({ type: 'connect' })

    cleanupRef.current = () => {
      messageCleanup()
      if (term.element) {
        term.element.removeEventListener('mousedown', handleMouse)
      }
      const xtermTextarea = container.querySelector('.xterm-helper-textarea')
      if (xtermTextarea) {
        xtermTextarea.removeEventListener('paste', handlePaste, true)
      }
      term.dispose()
    }

    return () => {
      cleanupRef.current?.()
      termRef.current = null
    }
  }, [sessionId, tab?.ws, updateScreen, setConnected])

  const handleReconnect = () => {
    tab?.ws?.send({ type: 'connect' })
  }

  const handleDisconnect = () => {
    tab?.ws?.send({ type: 'disconnect' })
  }

  const handleKeyClick = (key: string) => {
    tab?.ws?.send({ type: 'key', key })
    setKeyMenuOpen(false)
    termRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 w-fit">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 text-xs font-sans">
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getStatusColor(!!tab?.connected) }}
            />
            <span className="text-zinc-100 font-medium">
              {tab?.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Keys dropdown */}
          {tab?.connected && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setKeyMenuOpen(!keyMenuOpen)}
                className={`px-3 py-1.5 text-xs flex items-center gap-1 rounded border cursor-pointer transition-colors
                  ${keyMenuOpen
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 border-gray-300 dark:border-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-700'
                  }`}
              >
                Keys ▾
              </button>

              {keyMenuOpen && (
                <div className="absolute top-full left-0 mt-1 min-w-[340px] p-3 rounded-md border shadow-lg z-50 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  {/* PF Keys */}
                  <div className="mb-3">
                    <div className="text-[11px] uppercase mb-1.5 text-gray-500 dark:text-zinc-500 font-medium">
                      Function Keys
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {PF_KEYS.map((label) => (
                        <button
                          type="button"
                          key={label}
                          onClick={() => handleKeyClick(label.toLowerCase())}
                          className="px-1.5 py-1.5 text-[11px] rounded border cursor-pointer transition-colors
                            bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200
                            border-gray-300 dark:border-zinc-700
                            hover:bg-gray-200 dark:hover:bg-zinc-700 hover:border-gray-400 dark:hover:border-zinc-600
                            active:bg-gray-300 dark:active:bg-zinc-600"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* PA Keys */}
                  <div className="mb-3">
                    <div className="text-[11px] uppercase mb-1.5 text-gray-500 dark:text-zinc-500 font-medium">
                      Program Attention & Actions
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {PA_KEYS.map(({ label, key }) => (
                        <button
                          type="button"
                          key={label}
                          onClick={() => handleKeyClick(key)}
                          className={`px-2.5 py-1.5 text-[11px] rounded border cursor-pointer transition-colors
                            ${label === 'Enter'
                              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 active:bg-blue-800'
                              : 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 border-gray-300 dark:border-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:border-gray-400 dark:hover:border-zinc-600 active:bg-gray-300 dark:active:bg-zinc-600'
                            }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Keyboard Shortcuts */}
                  <div className="pt-2 border-t border-gray-200 dark:border-zinc-700">
                    <div className="text-[11px] uppercase mb-1.5 text-gray-500 dark:text-zinc-500 font-medium">
                      Keyboard Shortcuts
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                      {KEYBOARD_SHORTCUTS.map(({ keys, action }) => (
                        <div key={keys} className="flex justify-between">
                          <span className="text-gray-600 dark:text-zinc-400 font-mono">{keys}</span>
                          <span className="text-gray-500 dark:text-zinc-500">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Session ID */}
                  <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700">
                    <div className="text-[10px] text-gray-400 dark:text-zinc-500 font-mono truncate">
                      Session: {sessionId}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-zinc-300 text-xs">
            Cursor: ({tab?.meta.cursorRow},{tab?.meta.cursorCol})
            {tab?.meta.locked ? ' LOCKED' : ''}
          </span>
          {!tab?.connected ? (
            <button
              type="button"
              onClick={handleReconnect}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700 transition-colors"
            >
              Reconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDisconnect}
              className="px-3 py-1.5 text-xs rounded cursor-pointer transition-colors
                bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-200
                hover:bg-gray-300 dark:hover:bg-zinc-600"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Terminal container */}
      <div className="relative overscroll-contain">
        <div
          ref={containerRef}
          className="p-1"
          style={{ backgroundColor: '#000' }}
        />
        {!tab?.connected && (
          <div className="absolute inset-0 bg-zinc-950/95 flex items-center justify-center">
            <div className="text-center px-6">
              <div className="text-zinc-100 text-sm font-medium">Connecting...</div>
              <div className="text-zinc-400 text-xs mt-1">
                Establishing TN3270 session
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
