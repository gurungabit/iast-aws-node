import { describe, it, expect, vi, beforeEach } from 'vitest'

interface MockWebSocket {
  send: ReturnType<typeof vi.fn>
}

interface MockWorkerInstance {
  postMessage: ReturnType<typeof vi.fn>
  terminate: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
}

// Mock Worker class
const mockWorkerInstances: MockWorkerInstance[] = []
const MockWorker = vi.fn().mockImplementation(function (this: MockWorkerInstance) {
  this.postMessage = vi.fn()
  this.terminate = vi.fn()
  this.on = vi.fn()
  mockWorkerInstances.push(this)
  return this
})

vi.mock('worker_threads', () => ({
  Worker: MockWorker,
}))

vi.mock('../config.js', () => ({
  config: {
    maxWorkers: 3,
    tn3270Host: 'localhost',
    tn3270Port: 3270,
    tn3270Secure: false,
  },
}))

// Since manager.ts creates a singleton on import, we need to reset modules each time
// to get a fresh TerminalManager instance

type TerminalManager = Awaited<typeof import('./manager.js')>['terminalManager']

describe('TerminalManager', () => {
  let terminalManager: TerminalManager

  beforeEach(async () => {
    vi.clearAllMocks()
    mockWorkerInstances.length = 0
    MockWorker.mockClear()

    // Reset modules to get a fresh singleton
    vi.resetModules()

    // Re-mock dependencies before re-importing
    vi.doMock('worker_threads', () => ({
      Worker: MockWorker,
    }))

    vi.doMock('../config.js', () => ({
      config: {
        maxWorkers: 3,
        tn3270Host: 'localhost',
        tn3270Port: 3270,
        tn3270Secure: false,
      },
    }))

    const mod = await import('./manager.js')
    terminalManager = mod.terminalManager
  })

  describe('createWorker', () => {
    it('creates a new Worker and returns it', () => {
      const worker = terminalManager.createWorker('ses_001')

      expect(MockWorker).toHaveBeenCalledOnce()
      expect(worker).toBeDefined()
      expect(worker.on).toBeDefined()
    })

    it('returns existing worker if session already exists', () => {
      const worker1 = terminalManager.createWorker('ses_001')
      const worker2 = terminalManager.createWorker('ses_001')

      expect(worker1).toBe(worker2)
      expect(MockWorker).toHaveBeenCalledOnce()
    })

    it('throws when max workers are reached', () => {
      terminalManager.createWorker('ses_001')
      terminalManager.createWorker('ses_002')
      terminalManager.createWorker('ses_003')

      expect(() => terminalManager.createWorker('ses_004')).toThrow('Max workers (3) reached')
    })

    it('registers error and exit handlers on the worker', () => {
      const worker = terminalManager.createWorker('ses_001')

      const onCalls = worker.on.mock.calls
      const eventNames = onCalls.map((c: [string, ...unknown[]]) => c[0])
      expect(eventNames).toContain('error')
      expect(eventNames).toContain('exit')
    })

    it('passes workerData with session and terminal config', () => {
      terminalManager.createWorker('ses_001')

      expect(MockWorker).toHaveBeenCalledWith(
        expect.any(String), // worker file path
        {
          workerData: {
            sessionId: 'ses_001',
            tn3270Host: 'localhost',
            tn3270Port: 3270,
            tn3270Secure: false,
          },
        },
      )
    })
  })

  describe('getOrCreateWorker', () => {
    it('returns existing worker if one exists', () => {
      const worker = terminalManager.createWorker('ses_001')
      const same = terminalManager.getOrCreateWorker('ses_001')
      expect(same).toBe(worker)
    })

    it('creates a new worker if none exists', () => {
      const worker = terminalManager.getOrCreateWorker('ses_new')
      expect(worker).toBeDefined()
      expect(MockWorker).toHaveBeenCalledOnce()
    })
  })

  describe('attachWebSocket', () => {
    it('attaches a WebSocket to an existing session', () => {
      terminalManager.createWorker('ses_001')
      const mockWs: MockWebSocket = { send: vi.fn() }

      terminalManager.attachWebSocket('ses_001', mockWs)

      expect(terminalManager.getWebSocket('ses_001')).toBe(mockWs)
    })

    it('does nothing if session does not exist', () => {
      const mockWs: MockWebSocket = { send: vi.fn() }
      terminalManager.attachWebSocket('nonexistent', mockWs)

      expect(terminalManager.getWebSocket('nonexistent')).toBeUndefined()
    })
  })

  describe('detachWebSocket', () => {
    it('sets WebSocket to null for existing session', () => {
      terminalManager.createWorker('ses_001')
      const mockWs: MockWebSocket = { send: vi.fn() }

      terminalManager.attachWebSocket('ses_001', mockWs)
      expect(terminalManager.getWebSocket('ses_001')).toBe(mockWs)

      terminalManager.detachWebSocket('ses_001')
      expect(terminalManager.getWebSocket('ses_001')).toBeNull()
    })

    it('does nothing if session does not exist', () => {
      terminalManager.detachWebSocket('nonexistent')
      // No error thrown
    })
  })

  describe('getWorker', () => {
    it('returns the worker for a known session', () => {
      const worker = terminalManager.createWorker('ses_001')
      expect(terminalManager.getWorker('ses_001')).toBe(worker)
    })

    it('returns undefined for an unknown session', () => {
      expect(terminalManager.getWorker('unknown')).toBeUndefined()
    })
  })

  describe('getWebSocket', () => {
    it('returns null when no WebSocket attached', () => {
      terminalManager.createWorker('ses_001')
      expect(terminalManager.getWebSocket('ses_001')).toBeNull()
    })

    it('returns undefined for unknown session', () => {
      expect(terminalManager.getWebSocket('unknown')).toBeUndefined()
    })
  })

  describe('destroySession', () => {
    it('sends disconnect message and schedules terminate', () => {
      vi.useFakeTimers()
      const worker = terminalManager.createWorker('ses_001')

      terminalManager.destroySession('ses_001')

      expect(worker.postMessage).toHaveBeenCalledWith({ type: 'disconnect' })
      expect(terminalManager.getActiveCount()).toBe(0)

      // Worker.terminate() should be called after 1000ms
      vi.advanceTimersByTime(1000)
      expect(worker.terminate).toHaveBeenCalledOnce()

      vi.useRealTimers()
    })

    it('does nothing for unknown session', () => {
      terminalManager.destroySession('unknown')
      // No error thrown
    })

    it('removes the session from the workers map', () => {
      terminalManager.createWorker('ses_001')
      expect(terminalManager.getActiveCount()).toBe(1)

      terminalManager.destroySession('ses_001')
      expect(terminalManager.getActiveCount()).toBe(0)
      expect(terminalManager.getWorker('ses_001')).toBeUndefined()
    })

    it('handles postMessage throwing gracefully', () => {
      const worker = terminalManager.createWorker('ses_001')
      worker.postMessage.mockImplementation(() => {
        throw new Error('Worker already terminated')
      })

      // Should not throw
      terminalManager.destroySession('ses_001')
      expect(terminalManager.getActiveCount()).toBe(0)
    })
  })

  describe('getActiveCount', () => {
    it('returns 0 when no workers exist', () => {
      expect(terminalManager.getActiveCount()).toBe(0)
    })

    it('returns correct count after creating workers', () => {
      terminalManager.createWorker('ses_001')
      expect(terminalManager.getActiveCount()).toBe(1)

      terminalManager.createWorker('ses_002')
      expect(terminalManager.getActiveCount()).toBe(2)
    })

    it('decrements count after destroying a session', () => {
      terminalManager.createWorker('ses_001')
      terminalManager.createWorker('ses_002')
      expect(terminalManager.getActiveCount()).toBe(2)

      terminalManager.destroySession('ses_001')
      expect(terminalManager.getActiveCount()).toBe(1)
    })
  })

  describe('getMaxWorkers', () => {
    it('returns the configured maxWorkers value', () => {
      expect(terminalManager.getMaxWorkers()).toBe(3)
    })
  })

  describe('destroyAll', () => {
    it('destroys all active sessions', () => {
      terminalManager.createWorker('ses_001')
      terminalManager.createWorker('ses_002')
      terminalManager.createWorker('ses_003')
      expect(terminalManager.getActiveCount()).toBe(3)

      terminalManager.destroyAll()
      expect(terminalManager.getActiveCount()).toBe(0)
    })

    it('does nothing when no sessions exist', () => {
      terminalManager.destroyAll()
      expect(terminalManager.getActiveCount()).toBe(0)
    })

    it('sends disconnect to all workers', () => {
      terminalManager.createWorker('ses_001')
      terminalManager.createWorker('ses_002')

      const workers = [...mockWorkerInstances]
      terminalManager.destroyAll()

      for (const worker of workers) {
        expect(worker.postMessage).toHaveBeenCalledWith({ type: 'disconnect' })
      }
    })
  })

  describe('worker exit handler', () => {
    it('removes worker from map on exit event', () => {
      const worker = terminalManager.createWorker('ses_001')

      // Find the exit handler
      const exitCall = worker.on.mock.calls.find((c: [string, ...unknown[]]) => c[0] === 'exit')
      const exitHandler = exitCall[1]

      // Simulate exit
      exitHandler(0)

      expect(terminalManager.getWorker('ses_001')).toBeUndefined()
      expect(terminalManager.getActiveCount()).toBe(0)
    })

    it('removes worker from map on non-zero exit code', () => {
      const worker = terminalManager.createWorker('ses_001')

      const exitCall = worker.on.mock.calls.find((c: [string, ...unknown[]]) => c[0] === 'exit')
      const exitHandler = exitCall[1]

      // Simulate non-zero exit
      exitHandler(1)

      expect(terminalManager.getWorker('ses_001')).toBeUndefined()
    })
  })

  describe('worker error handler', () => {
    it('destroys session on worker error', () => {
      const worker = terminalManager.createWorker('ses_001')

      const errorCall = worker.on.mock.calls.find((c: [string, ...unknown[]]) => c[0] === 'error')
      const errorHandler = errorCall[1]

      // Simulate error
      errorHandler(new Error('Worker crashed'))

      // destroySession should have been called, removing the session
      expect(terminalManager.getActiveCount()).toBe(0)
    })
  })
})
