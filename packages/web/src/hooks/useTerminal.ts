import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { config } from '../config'
import { useSessionStore } from '../stores/session-store'
import { TerminalWebSocket, type ServerMessage } from '../services/websocket'

export function useTerminal(sessionId: string | null) {
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const { setWs, setConnected, updateScreen } = useSessionStore()

  const attach = useCallback(
    (container: HTMLDivElement | null) => {
      containerRef.current = container
      if (!container || !sessionId) return

      if (termRef.current) {
        termRef.current.dispose()
      }

      const term = new Terminal({
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
        allowTransparency: true,
        convertEol: false,
        disableStdin: true,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)

      term.open(container)
      fitAddon.fit()

      termRef.current = term
      fitAddonRef.current = fitAddon

      // Set up WebSocket
      const ws = new TerminalWebSocket(sessionId)
      setWs(sessionId, ws)

      const cleanup = ws.onMessage((msg: ServerMessage) => {
        switch (msg.type) {
          case 'connected':
            setConnected(sessionId, true)
            break
          case 'disconnected':
            setConnected(sessionId, false)
            break
          case 'screen':
            term.write(msg.ansi)
            updateScreen(sessionId, msg.ansi, msg.meta)
            break
          case 'error':
            console.error('Terminal error:', msg.message)
            break
        }
      })

      return () => {
        cleanup()
        ws.disconnect()
        term.dispose()
        termRef.current = null
      }
    },
    [sessionId, setWs, setConnected, updateScreen],
  )

  // Handle keyboard input
  const sendKey = useCallback(
    (key: string) => {
      if (!sessionId) return
      const tab = useSessionStore.getState().tabs.get(sessionId)
      tab?.ws?.send({ type: 'key', key })
    },
    [sessionId],
  )

  const sendData = useCallback(
    (text: string) => {
      if (!sessionId) return
      const tab = useSessionStore.getState().tabs.get(sessionId)
      tab?.ws?.send({ type: 'data', text })
    },
    [sessionId],
  )

  const connectToHost = useCallback(
    (host: string, port: number, options?: Record<string, unknown>) => {
      if (!sessionId) return
      const tab = useSessionStore.getState().tabs.get(sessionId)
      tab?.ws?.send({ type: 'connect', host, port, options })
    },
    [sessionId],
  )

  const disconnectFromHost = useCallback(() => {
    if (!sessionId) return
    const tab = useSessionStore.getState().tabs.get(sessionId)
    tab?.ws?.send({ type: 'disconnect' })
  }, [sessionId])

  // Resize handler
  useEffect(() => {
    const onResize = () => fitAddonRef.current?.fit()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return {
    attach,
    termRef,
    sendKey,
    sendData,
    connectToHost,
    disconnectFromHost,
  }
}
