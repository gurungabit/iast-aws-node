import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MainToWorkerMessage } from '@src/terminal/worker-messages.js'

const mockPostMessage = vi.hoisted(() => vi.fn())

// Store the captured handler in a hoisted container so it's available
// when the vi.hoisted() callback for mockOn runs.
const handlerBox = vi.hoisted(() => ({
  handler: null as ((msg: MainToWorkerMessage) => Promise<void>) | null,
}))

const mockOn = vi.hoisted(() =>
  vi.fn().mockImplementation((event: string, fn: (msg: MainToWorkerMessage) => Promise<void>) => {
    if (event === 'message') {
      handlerBox.handler = fn
    }
  }),
)

const mockParentPort = vi.hoisted(() => ({
  postMessage: mockPostMessage,
  on: mockOn,
}))

const mockTnzInstance = vi.hoisted(() => ({
  connect: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn(),
  on: vi.fn(),
  maxRow: 43,
  maxCol: 80,
  curadd: 0,
  pwait: false,
  systemLockWait: false,
  enter: vi.fn(),
  clear: vi.fn(),
  pf1: vi.fn(),
  pf15: vi.fn(),
  keyData: vi.fn(),
  setCursorPosition: vi.fn(),
  keyTab: vi.fn(),
}))

const mockAtiInstance = vi.hoisted(() => ({
  registerSession: vi.fn(),
}))

vi.mock('worker_threads', () => ({
  parentPort: mockParentPort,
  workerData: {
    sessionId: 'test-session',
    tn3270Host: 'localhost',
    tn3270Port: 23,
    tn3270Secure: false,
  },
}))

vi.mock('tnz3270-node', () => ({
  Tnz: function () {
    return mockTnzInstance
  },
  Ati: function () {
    return mockAtiInstance
  },
}))

vi.mock('@src/terminal/renderer.js', () => ({
  renderAnsiScreen: vi.fn().mockReturnValue('\x1B[H test screen'),
}))

// Import the module -- triggers side-effect of calling port.on('message', handler)
import '@src/terminal/worker.js'

describe('worker.ts', () => {
  let messageHandler: (msg: MainToWorkerMessage) => Promise<void>

  beforeEach(() => {
    // Only clear assertion mocks, preserving the captured handler
    mockPostMessage.mockClear()
    mockTnzInstance.connect.mockClear()
    mockTnzInstance.connect.mockResolvedValue(undefined)
    mockTnzInstance.shutdown.mockClear()
    mockTnzInstance.on.mockClear()
    mockTnzInstance.enter.mockClear()
    mockTnzInstance.clear.mockClear()
    mockTnzInstance.keyData.mockClear()
    mockTnzInstance.setCursorPosition.mockClear()
    mockAtiInstance.registerSession.mockClear()

    mockTnzInstance.pwait = false
    mockTnzInstance.systemLockWait = false
    mockTnzInstance.curadd = 0

    messageHandler = handlerBox.handler!
  })

  describe('connect message', () => {
    it('creates Tnz and Ati, connects, and sends connected message', async () => {
      await messageHandler({ type: 'connect' })

      expect(mockTnzInstance.connect).toHaveBeenCalledWith('localhost', 23, {
        secure: false,
        verifyCert: false,
      })
      expect(mockAtiInstance.registerSession).toHaveBeenCalledWith('WEB', mockTnzInstance)
      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'connected' })
    })
  })

  describe('disconnect message', () => {
    it('shuts down tnz and sends disconnected', async () => {
      await messageHandler({ type: 'connect' })
      mockPostMessage.mockClear()
      mockTnzInstance.shutdown.mockClear()

      await messageHandler({ type: 'disconnect' })
      expect(mockTnzInstance.shutdown).toHaveBeenCalled()
      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'disconnected' })
    })

    it('sends disconnected even when not connected', async () => {
      // First ensure disconnected state
      await messageHandler({ type: 'disconnect' })
      mockPostMessage.mockClear()

      await messageHandler({ type: 'disconnect' })
      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'disconnected' })
    })
  })

  describe('key message', () => {
    it('calls the corresponding tnz method for allowed keys', async () => {
      await messageHandler({ type: 'connect' })
      mockPostMessage.mockClear()

      await messageHandler({ type: 'key', key: 'enter' })
      expect(mockTnzInstance.enter).toHaveBeenCalled()
    })

    it('handles reset key by clearing lock flags', async () => {
      await messageHandler({ type: 'connect' })
      mockTnzInstance.systemLockWait = true
      mockTnzInstance.pwait = true
      mockPostMessage.mockClear()

      await messageHandler({ type: 'key', key: 'reset' })
      expect(mockTnzInstance.systemLockWait).toBe(false)
      expect(mockTnzInstance.pwait).toBe(false)
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'screen' }),
      )
    })

    it('ignores key when terminal is locked (pwait)', async () => {
      await messageHandler({ type: 'connect' })
      mockTnzInstance.pwait = true
      mockTnzInstance.enter.mockClear()

      await messageHandler({ type: 'key', key: 'enter' })
      expect(mockTnzInstance.enter).not.toHaveBeenCalled()
    })

    it('ignores key when terminal is locked (systemLockWait)', async () => {
      await messageHandler({ type: 'connect' })
      mockTnzInstance.systemLockWait = true
      mockTnzInstance.clear.mockClear()

      await messageHandler({ type: 'key', key: 'clear' })
      expect(mockTnzInstance.clear).not.toHaveBeenCalled()
    })
  })

  describe('data message', () => {
    it('sends keyData to tnz', async () => {
      await messageHandler({ type: 'connect' })
      mockTnzInstance.keyData.mockClear()

      await messageHandler({ type: 'data', text: 'hello' })
      expect(mockTnzInstance.keyData).toHaveBeenCalledWith('hello')
    })

    it('ignores data when terminal is locked', async () => {
      await messageHandler({ type: 'connect' })
      mockTnzInstance.systemLockWait = true
      mockTnzInstance.keyData.mockClear()

      await messageHandler({ type: 'data', text: 'hello' })
      expect(mockTnzInstance.keyData).not.toHaveBeenCalled()
    })
  })

  describe('cursor message', () => {
    it('sets cursor position', async () => {
      await messageHandler({ type: 'connect' })
      mockTnzInstance.setCursorPosition.mockClear()

      await messageHandler({ type: 'cursor', row: 5, col: 10 })
      expect(mockTnzInstance.setCursorPosition).toHaveBeenCalledWith(5, 10)
    })

    it('ignores cursor when terminal is locked', async () => {
      await messageHandler({ type: 'connect' })
      mockTnzInstance.pwait = true
      mockTnzInstance.setCursorPosition.mockClear()

      await messageHandler({ type: 'cursor', row: 5, col: 10 })
      expect(mockTnzInstance.setCursorPosition).not.toHaveBeenCalled()
    })
  })

  describe('ast.run message', () => {
    it('sends error when not connected (ati is null)', async () => {
      // Disconnect to set ati = null
      await messageHandler({ type: 'disconnect' })
      mockPostMessage.mockClear()

      await messageHandler({
        type: 'ast.run',
        astName: 'login',
        params: {},
        executionId: 'exec-1',
      })
      expect(mockPostMessage).toHaveBeenCalledWith({
        type: 'error',
        message: 'Not connected',
      })
    })
  })

  describe('error handling', () => {
    it('sends error message when connect throws', async () => {
      mockTnzInstance.connect.mockRejectedValueOnce(new Error('Connection refused'))
      await messageHandler({ type: 'connect' })
      expect(mockPostMessage).toHaveBeenCalledWith({
        type: 'error',
        message: expect.stringContaining('Connection refused'),
      })
    })
  })
})
