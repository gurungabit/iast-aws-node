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

export class TerminalWebSocket {
  private ws: WebSocket | null = null
  private sessionId: string
  private handlers = new Set<MessageHandler>()
  private reconnectTimer: number | null = null

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  async connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    const token = await getAccessToken()
    const url = `${config.wsUrl}/api/terminal/${this.sessionId}?token=${encodeURIComponent(token)}`
    this.ws = new WebSocket(url)

    this.ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data)
        for (const handler of this.handlers) {
          handler(msg)
        }
      } catch {
        // ignore malformed messages
      }
    }

    this.ws.onclose = () => {
      this.ws = null
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }

    // Wait for open
    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error('No WebSocket'))
      this.ws.onopen = () => resolve()
      const prevOnError = this.ws.onerror
      this.ws.onerror = (e) => {
        prevOnError?.call(this.ws!, e)
        reject(new Error('WebSocket connection failed'))
      }
    })
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
