import { useEffect, useRef, memo } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { config } from '../config'
import { useSessionStore } from '../stores/session-store'
import type { ServerMessage } from '../services/websocket'

interface TerminalProps {
  sessionId: string
}

const KEY_MAP: Record<string, string> = {
  Enter: 'enter',
  Escape: 'reset',
  Tab: 'keyTab',
  Backspace: 'keyBackspace',
  Delete: 'keyDelete',
  Home: 'keyHome',
  End: 'keyEnd',
  ArrowUp: 'keyCurUp',
  ArrowDown: 'keyCurDown',
  ArrowLeft: 'keyCurLeft',
  ArrowRight: 'keyCurRight',
  F1: 'pf1', F2: 'pf2', F3: 'pf3', F4: 'pf4', F5: 'pf5', F6: 'pf6',
  F7: 'pf7', F8: 'pf8', F9: 'pf9', F10: 'pf10', F11: 'pf11', F12: 'pf12',
  F13: 'pf13', F14: 'pf14', F15: 'pf15', F16: 'pf16', F17: 'pf17', F18: 'pf18',
  F19: 'pf19', F20: 'pf20', F21: 'pf21', F22: 'pf22', F23: 'pf23', F24: 'pf24',
}

// Shift+F1-F12 → PF13-PF24
const SHIFT_KEY_MAP: Record<string, string> = {
  F1: 'pf13', F2: 'pf14', F3: 'pf15', F4: 'pf16', F5: 'pf17', F6: 'pf18',
  F7: 'pf19', F8: 'pf20', F9: 'pf21', F10: 'pf22', F11: 'pf23', F12: 'pf24',
}

export const TerminalComponent = memo(function TerminalComponent({ sessionId }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const tab = useSessionStore((s) => s.tabs.get(sessionId))
  const updateScreen = useSessionStore((s) => s.updateScreen)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !tab?.ws) return

    const term = new XTerm({
      rows: config.terminal.rows,
      cols: config.terminal.cols,
      fontSize: config.terminal.fontSize,
      fontFamily: config.terminal.fontFamily,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#00ff00',
      },
      disableStdin: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)
    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    const cleanup = tab.ws.onMessage((msg: ServerMessage) => {
      if (msg.type === 'screen') {
        term.write(msg.ansi)
        updateScreen(sessionId, msg.ansi, msg.meta)
      }
    })

    cleanupRef.current = () => {
      cleanup()
      term.dispose()
    }

    return () => {
      cleanupRef.current?.()
      termRef.current = null
    }
  }, [sessionId, tab?.ws, updateScreen])

  // Keyboard handler
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!tab?.ws) return

    e.preventDefault()
    e.stopPropagation()

    // Ctrl+C → PA1, Ctrl+R → Reset
    if (e.ctrlKey) {
      if (e.key === 'c') { tab.ws.send({ type: 'key', key: 'pa1' }); return }
      if (e.key === 'r') { tab.ws.send({ type: 'key', key: 'reset' }); return }
    }

    // Shift+F keys
    if (e.shiftKey && SHIFT_KEY_MAP[e.key]) {
      tab.ws.send({ type: 'key', key: SHIFT_KEY_MAP[e.key] })
      return
    }

    // Special keys
    if (KEY_MAP[e.key]) {
      tab.ws.send({ type: 'key', key: KEY_MAP[e.key] })
      return
    }

    // Regular typing
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      tab.ws.send({ type: 'data', text: e.key })
    }
  }

  // Click → set cursor
  function handleClick(e: React.MouseEvent) {
    if (!tab?.ws || !termRef.current) return
    containerRef.current?.focus()

    const term = termRef.current
    const cellWidth = term.element!.clientWidth / config.terminal.cols
    const cellHeight = term.element!.clientHeight / config.terminal.rows
    const rect = term.element!.getBoundingClientRect()

    const col = Math.floor((e.clientX - rect.left) / cellWidth) + 1
    const row = Math.floor((e.clientY - rect.top) / cellHeight) + 1

    if (row >= 1 && row <= config.terminal.rows && col >= 1 && col <= config.terminal.cols) {
      tab.ws.send({ type: 'cursor', row, col })
    }
  }

  // Resize
  useEffect(() => {
    const onResize = () => fitAddonRef.current?.fit()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="relative">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-gray-900 px-2 py-0.5 text-[10px]">
        <span className={tab?.connected ? 'text-green-400' : 'text-gray-500'}>
          {tab?.connected ? 'Connected' : 'Disconnected'}
        </span>
        <span className="text-gray-500">
          {tab?.meta.cursorRow}:{tab?.meta.cursorCol}
          {tab?.meta.locked ? ' LOCKED' : ''}
        </span>
      </div>
      {/* Terminal */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        className="focus:outline-none"
        style={{ backgroundColor: '#000' }}
      />
    </div>
  )
})
