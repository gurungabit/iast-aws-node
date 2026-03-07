import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockWorker = vi.hoisted(() => ({
  postMessage: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}))

const mockTerminalManager = vi.hoisted(() => ({
  getOrCreateWorker: vi.fn().mockReturnValue(mockWorker),
  attachWebSocket: vi.fn(),
  detachWebSocket: vi.fn(),
}))

const mockVerifyWsToken = vi.hoisted(() => vi.fn())
const mockExecutionService = vi.hoisted(() => ({
  batchInsertPolicies: vi.fn().mockResolvedValue(undefined),
}))

const mockRegistry = vi.hoisted(() => ({
  getSessionAssignment: vi.fn().mockResolvedValue(null),
  registerSessionAssignment: vi.fn().mockResolvedValue(undefined),
  terminateSessionAssignment: vi.fn().mockResolvedValue(undefined),
  getLeastLoadedPod: vi.fn().mockResolvedValue('127.0.0.1'),
  isPodAlive: vi.fn().mockResolvedValue(true),
  discoverPods: vi.fn().mockResolvedValue(['127.0.0.1']),
}))

vi.mock('@src/terminal/manager.js', () => ({
  terminalManager: mockTerminalManager,
}))

vi.mock('@src/auth/ws-auth.js', () => ({
  verifyWsToken: mockVerifyWsToken,
}))

vi.mock('@src/services/execution.js', () => ({
  executionService: mockExecutionService,
}))

vi.mock('@src/terminal/registry.js', () => mockRegistry)

vi.mock('@src/config.js', () => ({
  config: {
    podIp: '127.0.0.1',
    port: 3000,
  },
}))

import { terminalWsRoutes } from '@src/terminal/ws-handler.js'

interface MockSocket {
  close: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  readyState: number
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  _handlerMap: Map<string, Array<(...args: unknown[]) => void>>
  _handlers: Record<string, (...args: unknown[]) => void>
}

interface MockReq {
  params: { sessionId: string }
  url: string
  headers: { host: string }
}

type RouteHandler = (socket: MockSocket, req: MockReq) => Promise<void>

function createMockSocket(): MockSocket {
  const handlerMap = new Map<string, Array<(...args: unknown[]) => void>>()
  const socket: MockSocket = {
    close: vi.fn(),
    send: vi.fn(),
    readyState: 1,
    on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlerMap.has(event)) handlerMap.set(event, [])
      handlerMap.get(event)!.push(handler)
    }),
    off: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      const list = handlerMap.get(event)
      if (list) {
        const idx = list.indexOf(handler)
        if (idx !== -1) list.splice(idx, 1)
      }
    }),
    _handlerMap: handlerMap,
    // Convenience: returns the last registered handler for an event
    get _handlers() {
      const result: Record<string, (...args: unknown[]) => void> = {}
      for (const [event, list] of handlerMap) {
        if (list.length > 0) result[event] = list[list.length - 1]
      }
      return result
    },
  }
  return socket
}

function createMockReq(sessionId: string, token?: string): MockReq {
  const tokenQuery = token ? `?token=${token}` : ''
  return {
    params: { sessionId },
    url: `/api/terminal/${sessionId}${tokenQuery}`,
    headers: { host: 'localhost:3000' },
  }
}

describe('terminalWsRoutes', () => {
  let publicHandler: RouteHandler
  let internalHandler: RouteHandler

  beforeEach(async () => {
    vi.clearAllMocks()
    // Default: new session assigned to this pod (127.0.0.1)
    mockRegistry.getSessionAssignment.mockResolvedValue(null)
    mockRegistry.getLeastLoadedPod.mockResolvedValue('127.0.0.1')

    const app = Fastify()
    const handlers: RouteHandler[] = []
    vi.spyOn(app, 'get').mockImplementation((...args: unknown[]) => {
      handlers.push(args[2] as RouteHandler)
      return app
    })
    // @ts-expect-error - mock log
    app.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

    await terminalWsRoutes(app)
    await app.close()

    publicHandler = handlers[0]   // /api/terminal/:sessionId
    internalHandler = handlers[1] // /internal/terminal/:sessionId
  })

  it('registers both public and internal routes', () => {
    expect(publicHandler).toBeDefined()
    expect(internalHandler).toBeDefined()
  })

  it('closes socket with 4001 when authentication fails', async () => {
    mockVerifyWsToken.mockResolvedValue(null)

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'bad-token')

    await publicHandler(socket, req)

    expect(socket.close).toHaveBeenCalledWith(4001, 'Unauthorized')
  })

  it('assigns new session to least-loaded pod and creates local worker', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'valid-token')

    await publicHandler(socket, req)

    expect(mockRegistry.getSessionAssignment).toHaveBeenCalledWith('sess-1')
    expect(mockRegistry.getLeastLoadedPod).toHaveBeenCalled()
    expect(mockRegistry.registerSessionAssignment).toHaveBeenCalledWith('sess-1', '127.0.0.1', 'user-1')
    expect(mockTerminalManager.getOrCreateWorker).toHaveBeenCalledWith('sess-1')
    expect(mockTerminalManager.attachWebSocket).toHaveBeenCalledWith('sess-1', socket)
  })

  it('uses existing assignment for local session', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })
    mockRegistry.getSessionAssignment.mockResolvedValue({ podIp: '127.0.0.1', userId: 'user-1', status: 'active' })

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'valid-token')

    await publicHandler(socket, req)

    expect(mockRegistry.getLeastLoadedPod).not.toHaveBeenCalled()
    expect(mockTerminalManager.getOrCreateWorker).toHaveBeenCalledWith('sess-1')
  })

  it('forwards browser messages to worker', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'valid-token')

    await publicHandler(socket, req)

    const messageHandler = socket._handlers['message']
    const msg = JSON.stringify({ type: 'connect' })
    messageHandler(Buffer.from(msg))

    expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'connect' })
  })

  it('ignores malformed browser messages', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'valid-token')

    await publicHandler(socket, req)

    const messageHandler = socket._handlers['message']
    messageHandler(Buffer.from('not valid json'))
    expect(mockWorker.postMessage).not.toHaveBeenCalled()
  })

  it('forwards worker messages to browser socket', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'valid-token')

    await publicHandler(socket, req)

    const workerOnCall = mockWorker.on.mock.calls.find(
      (call: [string, ...unknown[]]) => call[0] === 'message',
    )
    const workerMsgHandler = workerOnCall![1]

    workerMsgHandler({ type: 'connected' })
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'connected' }))
  })

  it('persists ast.item_result_batch to execution service on flush', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'valid-token')

    await publicHandler(socket, req)

    const workerOnCall = mockWorker.on.mock.calls.find(
      (call: [string, ...unknown[]]) => call[0] === 'message',
    )
    const workerMsgHandler = workerOnCall![1]

    const batchMsg = {
      type: 'ast.item_result_batch',
      executionId: 'exec-1',
      items: [{ id: 'i1', policyNumber: 'POL1', status: 'success', durationMs: 100 }],
    }
    workerMsgHandler(batchMsg)

    // DB writes are buffered — trigger flush via socket close
    const closeHandler = socket._handlers['close']
    closeHandler()

    // Wait for any async flush
    await new Promise((r) => setTimeout(r, 0))

    expect(mockExecutionService.batchInsertPolicies).toHaveBeenCalledWith(
      'exec-1',
      batchMsg.items,
    )
  })

  it('does not send to socket when readyState is not OPEN', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })

    const socket = createMockSocket()
    socket.readyState = 3 // CLOSED
    const req = createMockReq('sess-1', 'valid-token')

    await publicHandler(socket, req)

    const workerOnCall = mockWorker.on.mock.calls.find(
      (call: [string, ...unknown[]]) => call[0] === 'message',
    )
    const workerMsgHandler = workerOnCall![1]

    workerMsgHandler({ type: 'connected' })
    expect(socket.send).not.toHaveBeenCalled()
  })

  it('cleans up on socket close', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'valid-token')

    await publicHandler(socket, req)

    const closeHandler = socket._handlers['close']
    closeHandler()

    expect(mockWorker.off).toHaveBeenCalledWith('message', expect.any(Function))
    expect(mockTerminalManager.detachWebSocket).toHaveBeenCalledWith('sess-1')
  })

  it('cleans up on socket error', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'valid-token')

    await publicHandler(socket, req)

    const errorHandler = socket._handlers['error']
    errorHandler()

    expect(mockWorker.off).toHaveBeenCalledWith('message', expect.any(Function))
    expect(mockTerminalManager.detachWebSocket).toHaveBeenCalledWith('sess-1')
  })

  it('extracts token from query parameters', async () => {
    mockVerifyWsToken.mockResolvedValue(null)

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'my-token')

    await publicHandler(socket, req)

    expect(mockVerifyWsToken).toHaveBeenCalledWith('my-token')
  })

  it('passes undefined token when no token in query', async () => {
    mockVerifyWsToken.mockResolvedValue(null)

    const socket = createMockSocket()
    const req = createMockReq('sess-1')

    await publicHandler(socket, req)

    expect(mockVerifyWsToken).toHaveBeenCalledWith(undefined)
  })

  it('replays messages buffered during async setup', async () => {
    // Simulate: browser sends { type: 'connect' } while server is still doing auth/routing
    mockVerifyWsToken.mockImplementation(async () => {
      // While verifyWsToken is running, simulate the browser sending a message.
      // The buffer handler was registered synchronously before this await,
      // so it should capture the message.
      const bufferHandlers = socket._handlerMap.get('message')
      if (bufferHandlers?.[0]) {
        bufferHandlers[0](Buffer.from(JSON.stringify({ type: 'connect' })))
      }
      return { id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' }
    })

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'valid-token')

    await publicHandler(socket, req)

    // The buffered 'connect' message should have been replayed to the worker
    expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'connect' })
  })

  it('removes buffer handler on auth failure', async () => {
    mockVerifyWsToken.mockResolvedValue(null)

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'bad-token')

    await publicHandler(socket, req)

    expect(socket.off).toHaveBeenCalledWith('message', expect.any(Function))
    expect(socket.close).toHaveBeenCalledWith(4001, 'Unauthorized')
  })

  describe('internal route', () => {
    it('attaches directly to local worker without auth', async () => {
      const socket = createMockSocket()
      const req = createMockReq('sess-1')

      await internalHandler(socket, req)

      expect(mockTerminalManager.getOrCreateWorker).toHaveBeenCalledWith('sess-1')
      expect(mockTerminalManager.attachWebSocket).toHaveBeenCalledWith('sess-1', socket)
      expect(mockVerifyWsToken).not.toHaveBeenCalled()
    })
  })
})
