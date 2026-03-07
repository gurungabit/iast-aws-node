import { config } from '../config'
import { getAccessToken } from '../auth/token'

export type ServerMessage =
  | { type: 'connected' }
  | { type: 'disconnected'; reason?: string }
  | {
      type: 'screen'
      ansi: string
      meta: { cursorRow: number; cursorCol: number; locked: boolean; rows: number; cols: number }
    }
  | { type: 'ast.status'; status: string; astName: string; executionId: string }
  | { type: 'ast.progress'; progress: { current: number; total: number; message: string } }
  | { type: 'ast.item_result_batch'; executionId: string; items: ASTItemResult[] }
  | { type: 'ast.complete'; status: string; executionId: string; error?: string }
  | { type: 'error'; message: string; code?: string }

export interface ASTItemResult {
  id: string
  policyNumber: string
  status: 'success' | 'failure' | 'skipped' | 'error'
  durationMs: number
  error?: string
  data?: Record<string, unknown>
}

type MessageHandler = (msg: ServerMessage) => void

const MAX_RECONNECT_ATTEMPTS = 5

export class TerminalWebSocket {
  private ws: WebSocket | null = null
  private sessionId: string
  private handlers = new Set<MessageHandler>()
  private reconnectTimer: number | null = null
  private reconnectAttempts = 0
  private intentionalClose = false

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  async connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.intentionalClose = false

    const token = await getAccessToken()
    const url = `${config.wsUrl}/api/terminal/${this.sessionId}?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)

    // Wait for connection to open
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error('WebSocket connection failed'))
    })

    // Connected — set up persistent handlers
    this.reconnectAttempts = 0

    ws.onmessage = (event) => {
      try {
        this.emit(JSON.parse(event.data) as ServerMessage)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      this.ws = null
      if (!this.intentionalClose) {
        this.emit({ type: 'disconnected', reason: 'connection_lost' })
        this.scheduleReconnect()
      }
    }

    ws.onerror = () => {
      ws.close()
    }

    this.ws = ws
  }

  private emit(msg: ServerMessage) {
    for (const handler of this.handlers) {
      handler(msg)
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.emit({
        type: 'error',
        message: 'Connection lost after multiple retries. Please refresh the page.',
      })
      return
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000)
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectAttempts++
      this.connect()
        .then(() => {
          // Re-attach to the mainframe session on the server
          this.send({ type: 'connect' })
        })
        .catch(() => {
          this.scheduleReconnect()
        })
    }, delay)
  }

  send(msg: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  disconnect() {
    this.intentionalClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = 0
    this.ws?.close()
    this.ws = null
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
