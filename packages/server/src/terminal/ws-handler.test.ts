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

vi.mock('./manager.js', () => ({
  terminalManager: mockTerminalManager,
}))

vi.mock('../auth/ws-auth.js', () => ({
  verifyWsToken: mockVerifyWsToken,
}))

vi.mock('../services/execution.js', () => ({
  executionService: mockExecutionService,
}))

import { terminalWsRoutes } from './ws-handler.js'

interface MockSocket {
  close: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  readyState: number
  on: ReturnType<typeof vi.fn>
  _handlers: Record<string, (...args: unknown[]) => void>
}

interface MockReq {
  params: { sessionId: string }
  url: string
  headers: { host: string }
}

type RouteHandler = (socket: MockSocket, req: MockReq) => Promise<void>

function createMockSocket(): MockSocket {
  const handlers: Record<string, (...args: unknown[]) => void> = {}
  return {
    close: vi.fn(),
    send: vi.fn(),
    readyState: 1,
    on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler
    }),
    _handlers: handlers,
  }
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
  let routeHandler: RouteHandler

  beforeEach(async () => {
    vi.clearAllMocks()

    const app = Fastify()
    vi.spyOn(app, 'get').mockImplementation((...args: unknown[]) => {
      routeHandler = args[2] as RouteHandler
      return app
    })

    await terminalWsRoutes(app)
    await app.close()
  })

  it('registers a GET route for /api/terminal/:sessionId', async () => {
    // The route was registered in beforeEach
    expect(routeHandler).toBeDefined()
  })

  it('closes socket with 4001 when authentication fails', async () => {
    mockVerifyWsToken.mockResolvedValue(null)

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'bad-token')

    await routeHandler(socket, req)

    expect(socket.close).toHaveBeenCalledWith(4001, 'Unauthorized')
  })

  it('creates or gets worker for the session', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'valid-token')

    await routeHandler(socket, req)

    expect(mockTerminalManager.getOrCreateWorker).toHaveBeenCalledWith('sess-1')
    expect(mockTerminalManager.attachWebSocket).toHaveBeenCalledWith('sess-1', socket)
  })

  it('forwards browser messages to worker', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'valid-token')

    await routeHandler(socket, req)

    // Simulate incoming message from browser
    const messageHandler = socket._handlers['message']
    const msg = JSON.stringify({ type: 'connect' })
    messageHandler(Buffer.from(msg))

    expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'connect' })
  })

  it('ignores malformed browser messages', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'valid-token')

    await routeHandler(socket, req)

    const messageHandler = socket._handlers['message']
    // Should not throw
    messageHandler(Buffer.from('not valid json'))
    expect(mockWorker.postMessage).not.toHaveBeenCalled()
  })

  it('forwards worker messages to browser socket', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'valid-token')

    await routeHandler(socket, req)

    // Extract the worker message handler
    const workerOnCall = mockWorker.on.mock.calls.find(
      (call: [string, ...unknown[]]) => call[0] === 'message',
    )
    const workerMsgHandler = workerOnCall![1]

    workerMsgHandler({ type: 'connected' })
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'connected' }))
  })

  it('persists ast.item_result_batch to execution service', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'valid-token')

    await routeHandler(socket, req)

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

    expect(mockExecutionService.batchInsertPolicies).toHaveBeenCalledWith(
      'exec-1',
      batchMsg.items,
    )
  })

  it('does not send to socket when readyState is not 1 (OPEN)', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })

    const socket = createMockSocket()
    socket.readyState = 3 // CLOSED
    const req = createMockReq('sess-1', 'valid-token')

    await routeHandler(socket, req)

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

    await routeHandler(socket, req)

    const closeHandler = socket._handlers['close']
    closeHandler()

    expect(mockWorker.off).toHaveBeenCalledWith('message', expect.any(Function))
    expect(mockTerminalManager.detachWebSocket).toHaveBeenCalledWith('sess-1')
  })

  it('cleans up on socket error', async () => {
    mockVerifyWsToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', displayName: 'User', entraId: 'oid' })

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'valid-token')

    await routeHandler(socket, req)

    const errorHandler = socket._handlers['error']
    errorHandler()

    expect(mockWorker.off).toHaveBeenCalledWith('message', expect.any(Function))
    expect(mockTerminalManager.detachWebSocket).toHaveBeenCalledWith('sess-1')
  })

  it('extracts token from query parameters', async () => {
    mockVerifyWsToken.mockResolvedValue(null)

    const socket = createMockSocket()
    const req = createMockReq('sess-1', 'my-token')

    await routeHandler(socket, req)

    expect(mockVerifyWsToken).toHaveBeenCalledWith('my-token')
  })

  it('passes undefined token when no token in query', async () => {
    mockVerifyWsToken.mockResolvedValue(null)

    const socket = createMockSocket()
    const req = createMockReq('sess-1')

    await routeHandler(socket, req)

    expect(mockVerifyWsToken).toHaveBeenCalledWith(undefined)
  })
})
