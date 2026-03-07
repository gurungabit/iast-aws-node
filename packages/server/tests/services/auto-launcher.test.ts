import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
}))

const mockExecutionService = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue({ id: 'exec-1' }),
}))

vi.mock('@src/db/index.js', () => ({ db: mockDb }))
vi.mock('@src/db/schema/index.js', () => ({
  autoLaunchers: { id: 'id', ownerId: 'ownerId', visibility: 'visibility' },
  autoLauncherRuns: { id: 'id', userId: 'userId' },
}))
vi.mock('@src/services/execution.js', () => ({ executionService: mockExecutionService }))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => val),
  and: vi.fn((...args: unknown[]) => args),
  or: vi.fn((...args: unknown[]) => args),
}))
vi.mock('worker_threads', () => ({
  Worker: class {
    postMessage = vi.fn()
    on = vi.fn()
    off = vi.fn()
  },
}))

import { Worker } from 'worker_threads'
import { autoLauncherService } from '@src/services/auto-launcher.js'

describe('autoLauncherService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.delete.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.limit.mockReturnThis()
    mockDb.offset.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.values.mockReturnThis()
  })

  describe('create', () => {
    it('inserts a new auto-launcher with defaults', async () => {
      const launcher = { id: 'al1', name: 'Launcher 1', visibility: 'private' }
      mockDb.returning.mockResolvedValueOnce([launcher])

      const result = await autoLauncherService.create({
        ownerId: 'u1',
        name: 'Launcher 1',
      })

      expect(result).toEqual(launcher)
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: 'u1',
          name: 'Launcher 1',
          visibility: 'private',
          steps: [],
        }),
      )
    })

    it('uses provided visibility and steps', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'al2' }])

      await autoLauncherService.create({
        ownerId: 'u1',
        name: 'Public',
        visibility: 'public',
        steps: [{ astName: 'ast1', params: {} }],
      })

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'public',
          steps: [{ astName: 'ast1', params: {} }],
        }),
      )
    })
  })

  describe('findVisible', () => {
    it('returns own and public launchers', async () => {
      const launchers = [{ id: 'al1' }]
      mockDb.where.mockResolvedValueOnce(launchers)

      const result = await autoLauncherService.findVisible('u1')

      expect(result).toEqual(launchers)
    })
  })

  describe('findById', () => {
    it('returns launcher when found', async () => {
      const launcher = { id: 'al1', name: 'Test' }
      mockDb.limit.mockResolvedValueOnce([launcher])

      const result = await autoLauncherService.findById('al1')

      expect(result).toEqual(launcher)
    })

    it('returns null when not found', async () => {
      mockDb.limit.mockResolvedValueOnce([undefined])

      const result = await autoLauncherService.findById('missing')

      expect(result).toBeNull()
    })
  })

  describe('update', () => {
    it('updates launcher and returns it', async () => {
      const updated = { id: 'al1', name: 'Updated' }
      mockDb.returning.mockResolvedValueOnce([updated])

      const result = await autoLauncherService.update('al1', 'u1', { name: 'Updated' })

      expect(result).toEqual(updated)
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated', updatedAt: expect.any(Date) }),
      )
    })

    it('returns null when launcher not found or not owned', async () => {
      mockDb.returning.mockResolvedValueOnce([undefined])

      const result = await autoLauncherService.update('missing', 'u1', { name: 'X' })

      expect(result).toBeNull()
    })
  })

  describe('remove', () => {
    it('returns true when launcher is deleted', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'al1' }])

      const result = await autoLauncherService.remove('al1', 'u1')

      expect(result).toBe(true)
    })

    it('returns false when launcher not found', async () => {
      mockDb.returning.mockResolvedValueOnce([])

      const result = await autoLauncherService.remove('nonexistent', 'u1')

      expect(result).toBe(false)
    })
  })

  describe('createRun', () => {
    it('inserts a new run and returns it', async () => {
      const run = { id: 'run1', launcherId: 'al1', userId: 'u1', sessionId: 's1', steps: [] }
      mockDb.returning.mockResolvedValueOnce([run])

      const result = await autoLauncherService.createRun({
        id: 'run1',
        launcherId: 'al1',
        userId: 'u1',
        sessionId: 's1',
        steps: [],
      })

      expect(result).toEqual(run)
    })
  })

  describe('updateRun', () => {
    it('updates a run and returns it', async () => {
      const updated = { id: 'run1', status: 'completed' }
      mockDb.returning.mockResolvedValueOnce([updated])

      const result = await autoLauncherService.updateRun('run1', { status: 'completed' })

      expect(result).toEqual(updated)
    })

    it('returns null when run not found', async () => {
      mockDb.returning.mockResolvedValueOnce([undefined])

      const result = await autoLauncherService.updateRun('missing', { status: 'failed' })

      expect(result).toBeNull()
    })
  })

  describe('findRunsByUser', () => {
    it('returns runs for the user with default limit and offset', async () => {
      const runs = [{ id: 'run1' }]
      mockDb.offset.mockResolvedValueOnce(runs)

      const result = await autoLauncherService.findRunsByUser('u1')

      expect(result).toEqual(runs)
      expect(mockDb.limit).toHaveBeenCalledWith(50)
      expect(mockDb.offset).toHaveBeenCalledWith(0)
    })

    it('uses custom limit and offset', async () => {
      mockDb.offset.mockResolvedValueOnce([])

      await autoLauncherService.findRunsByUser('u1', 10, 5)

      expect(mockDb.limit).toHaveBeenCalledWith(10)
      expect(mockDb.offset).toHaveBeenCalledWith(5)
    })
  })

  describe('executeRun', () => {
    function createMockWorker() {
      const handlers = new Map<string, ((...args: unknown[]) => void)[]>()
      const worker = new Worker('')

      vi.mocked(worker.on).mockImplementation(
        (event: string | symbol, handler: (...args: unknown[]) => void) => {
          const key = String(event)
          const existing = handlers.get(key) || []
          existing.push(handler)
          handlers.set(key, existing)
          return worker
        },
      )
      vi.mocked(worker.off).mockImplementation(
        (event: string | symbol, handler: (...args: unknown[]) => void) => {
          const key = String(event)
          const existing = handlers.get(key) || []
          handlers.set(key, existing.filter((h) => h !== handler))
          return worker
        },
      )

      function emit(event: string, data: unknown) {
        const list = handlers.get(event) || []
        for (const h of list) h(data)
      }

      return { worker, emit }
    }

    it('executes all steps successfully', async () => {
      const { worker, emit } = createMockWorker()
      // updateRun calls: running state, step 0 running, step 0 done, step 1 running, step 1 done, completed
      mockDb.returning.mockResolvedValue([{ id: 'run1' }])

      const steps = [
        { astName: 'ast1', params: { key: 'val1' } },
        { astName: 'ast2', params: { key: 'val2' } },
      ]

      // Simulate worker completing each step
      vi.mocked(worker.postMessage).mockImplementation((msg: { executionId: string }) => {
        setTimeout(() => {
          emit('message', {
            type: 'ast.complete',
            executionId: msg.executionId,
            status: 'completed',
          })
        }, 0)
      })

      await autoLauncherService.executeRun('run1', worker, steps, 's1')

      expect(worker.postMessage).toHaveBeenCalledTimes(2)
      expect(worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ast.run',
          astName: 'ast1',
          executionId: 'run1-step-0',
        }),
      )
      expect(worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ast.run',
          astName: 'ast2',
          executionId: 'run1-step-1',
        }),
      )

      // Final updateRun call should have status: 'completed'
      const lastUpdateCall = mockDb.set.mock.calls[mockDb.set.mock.calls.length - 1][0]
      expect(lastUpdateCall).toEqual(
        expect.objectContaining({ status: 'completed', completedAt: expect.any(Date) }),
      )
    })

    it('marks remaining steps as cancelled when a step fails', async () => {
      const { worker, emit } = createMockWorker()
      mockDb.returning.mockResolvedValue([{ id: 'run1' }])

      const steps = [
        { astName: 'ast1', params: {} },
        { astName: 'ast2', params: {} },
        { astName: 'ast3', params: {} },
      ]

      let callCount = 0
      vi.mocked(worker.postMessage).mockImplementation((msg: { executionId: string }) => {
        callCount++
        setTimeout(() => {
          if (callCount === 1) {
            // First step succeeds
            emit('message', {
              type: 'ast.complete',
              executionId: msg.executionId,
              status: 'completed',
            })
          } else {
            // Second step fails
            emit('message', {
              type: 'ast.complete',
              executionId: msg.executionId,
              status: 'failed',
              error: 'Something went wrong',
            })
          }
        }, 0)
      })

      await autoLauncherService.executeRun('run1', worker, steps, 's1')

      // Only 2 postMessage calls (step 0 and step 1); step 2 is never run
      expect(worker.postMessage).toHaveBeenCalledTimes(2)

      // The update that recorded the failure should include cancelled steps
      const failUpdateCall = mockDb.set.mock.calls[mockDb.set.mock.calls.length - 1][0]
      expect(failUpdateCall.status).toBe('failed')
      expect(failUpdateCall.steps[2].status).toBe('cancelled')
    })

    it('handles empty steps array (completes immediately)', async () => {
      const { worker } = createMockWorker()
      mockDb.returning.mockResolvedValue([{ id: 'run1' }])

      await autoLauncherService.executeRun('run1', worker, [], 's1')

      expect(worker.postMessage).not.toHaveBeenCalled()
      // Should still call updateRun with completed status
      const lastSetCall = mockDb.set.mock.calls[mockDb.set.mock.calls.length - 1][0]
      expect(lastSetCall).toEqual(
        expect.objectContaining({ status: 'completed', completedAt: expect.any(Date) }),
      )
    })
  })
})
