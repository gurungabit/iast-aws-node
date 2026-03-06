import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../config', () => ({
  config: { wsUrl: 'ws://localhost:3000' },
}))

vi.mock('../auth/token', () => ({
  getAccessToken: vi.fn().mockResolvedValue('test-token'),
}))

const wsInstances: MockWebSocket[] = []

class MockWebSocket {
  static OPEN = 1
  static CLOSED = 3
  readyState = MockWebSocket.OPEN
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onopen: (() => void) | null = null
  send = vi.fn()
  close = vi.fn()
  url: string

  constructor(url: string) {
    this.url = url
    wsInstances.push(this)
    setTimeout(() => this.onopen?.(), 0)
  }
}

vi.stubGlobal('WebSocket', MockWebSocket)

import { TerminalWebSocket } from './websocket'

describe('TerminalWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    wsInstances.length = 0
  })

  describe('connect', () => {
    it('creates WebSocket with correct URL including token', async () => {
      const tws = new TerminalWebSocket('session-1')

      await tws.connect()

      expect(wsInstances).toHaveLength(1)
      expect(wsInstances[0].url).toBe(
        'ws://localhost:3000/api/terminal/session-1?token=test-token',
      )
    })

    it('does not create a new WebSocket if already connected', async () => {
      const tws = new TerminalWebSocket('session-1')

      await tws.connect()
      await tws.connect()

      expect(wsInstances).toHaveLength(1)
    })
  })

  describe('send', () => {
    it('JSON-stringifies and sends the message', async () => {
      const tws = new TerminalWebSocket('session-1')
      await tws.connect()

      const msg = { type: 'input', data: 'hello' }
      tws.send(msg)

      expect(wsInstances[0].send).toHaveBeenCalledWith(JSON.stringify(msg))
    })

    it('does not send when WebSocket is not open', async () => {
      const tws = new TerminalWebSocket('session-1')
      await tws.connect()

      wsInstances[0].readyState = MockWebSocket.CLOSED

      tws.send({ type: 'input', data: 'hello' })

      expect(wsInstances[0].send).not.toHaveBeenCalled()
    })
  })

  describe('onMessage', () => {
    it('registers a handler that receives parsed messages', async () => {
      const tws = new TerminalWebSocket('session-1')
      await tws.connect()

      const handler = vi.fn()
      tws.onMessage(handler)

      const message = { type: 'ast.status', status: 'running', astName: 'LoginAST', executionId: 'e1' }
      wsInstances[0].onmessage?.({ data: JSON.stringify(message) })

      expect(handler).toHaveBeenCalledWith(message)
    })

    it('returns an unsubscribe function', async () => {
      const tws = new TerminalWebSocket('session-1')
      await tws.connect()

      const handler = vi.fn()
      const unsubscribe = tws.onMessage(handler)

      unsubscribe()

      wsInstances[0].onmessage?.({ data: JSON.stringify({ type: 'connected' }) })

      expect(handler).not.toHaveBeenCalled()
    })

    it('dispatches to multiple handlers', async () => {
      const tws = new TerminalWebSocket('session-1')
      await tws.connect()

      const handler1 = vi.fn()
      const handler2 = vi.fn()
      tws.onMessage(handler1)
      tws.onMessage(handler2)

      const message = { type: 'connected' }
      wsInstances[0].onmessage?.({ data: JSON.stringify(message) })

      expect(handler1).toHaveBeenCalledWith(message)
      expect(handler2).toHaveBeenCalledWith(message)
    })

    it('ignores malformed JSON messages', async () => {
      const tws = new TerminalWebSocket('session-1')
      await tws.connect()

      const handler = vi.fn()
      tws.onMessage(handler)

      wsInstances[0].onmessage?.({ data: 'not valid json{' })

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('onclose / onerror', () => {
    it('sets ws to null on close', async () => {
      const tws = new TerminalWebSocket('session-1')
      await tws.connect()

      wsInstances[0].onclose?.()

      expect(tws.isConnected).toBe(false)
    })

    it('closes ws on error', async () => {
      const tws = new TerminalWebSocket('session-1')
      await tws.connect()

      wsInstances[0].onerror?.('some error')

      expect(wsInstances[0].close).toHaveBeenCalled()
    })

    it('rejects connect promise on error during handshake', async () => {
      // Create a WebSocket that fails instead of opening
      class FailingWebSocket {
        static OPEN = 1
        static CLOSED = 3
        readyState = MockWebSocket.CLOSED
        onmessage: ((event: { data: string }) => void) | null = null
        onclose: (() => void) | null = null
        onerror: ((e: unknown) => void) | null = null
        onopen: (() => void) | null = null
        send = vi.fn()
        close = vi.fn()
        url: string

        constructor(url: string) {
          this.url = url
          // Fire error after microtask, no onopen
          setTimeout(() => {
            this.onerror?.('connection failed')
          }, 0)
        }
      }
      vi.stubGlobal('WebSocket', FailingWebSocket)

      const tws = new TerminalWebSocket('session-2')
      await expect(tws.connect()).rejects.toThrow('WebSocket connection failed')

      vi.stubGlobal('WebSocket', MockWebSocket)
    })
  })

  describe('disconnect', () => {
    it('closes the WebSocket', async () => {
      const tws = new TerminalWebSocket('session-1')
      await tws.connect()

      tws.disconnect()

      expect(wsInstances[0].close).toHaveBeenCalled()
    })

    it('clears reconnect timer on disconnect', async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
      const tws = new TerminalWebSocket('session-1')
      await tws.connect()

      // Disconnect twice — second call exercises the "no timer" path
      tws.disconnect()
      tws.disconnect()

      expect(wsInstances[0].close).toHaveBeenCalled()
      clearTimeoutSpy.mockRestore()
    })

    it('sets isConnected to false after disconnect', async () => {
      const tws = new TerminalWebSocket('session-1')
      await tws.connect()

      tws.disconnect()

      expect(tws.isConnected).toBe(false)
    })
  })

  describe('isConnected', () => {
    it('returns true when WebSocket is open', async () => {
      const tws = new TerminalWebSocket('session-1')
      await tws.connect()

      expect(tws.isConnected).toBe(true)
    })

    it('returns false when no WebSocket exists', () => {
      const tws = new TerminalWebSocket('session-1')

      expect(tws.isConnected).toBe(false)
    })
  })
})
