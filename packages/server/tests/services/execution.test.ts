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
  orderBy: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
}))

vi.mock('@src/db/index.js', () => ({ db: mockDb }))
vi.mock('@src/db/schema/index.js', () => ({
  executions: {
    id: 'id',
    userId: 'userId',
    executionDate: 'executionDate',
    startedAt: 'startedAt',
    totalPolicies: 'totalPolicies',
    successCount: 'successCount',
    failureCount: 'failureCount',
    errorCount: 'errorCount',
  },
  policyResults: {
    executionId: 'executionId',
    status: 'status',
  },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => val),
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col) => col),
  sql: new Proxy(() => 'sql-expr', { apply: () => 'sql-expr', get: () => 'sql-expr' }),
}))

import { executionService } from '@src/services/execution.js'

describe('executionService', () => {
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
    mockDb.orderBy.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.values.mockReturnThis()
  })

  describe('create', () => {
    it('inserts a new execution and returns it', async () => {
      const exec = { id: 'e1', sessionId: 's1', userId: 'u1', astName: 'ast1', executionDate: '2026-01-01' }
      mockDb.returning.mockResolvedValueOnce([exec])

      const result = await executionService.create(exec)

      expect(result).toEqual(exec)
      expect(mockDb.insert).toHaveBeenCalled()
      expect(mockDb.values).toHaveBeenCalledWith(exec)
    })
  })

  describe('updateStatus', () => {
    it('updates status without counts', async () => {
      const updated = { id: 'e1', status: 'running' }
      mockDb.returning.mockResolvedValueOnce([updated])

      const result = await executionService.updateStatus('e1', 'running')

      expect(result).toEqual(updated)
      expect(mockDb.set).toHaveBeenCalledWith({ status: 'running' })
    })

    it('includes counts when provided', async () => {
      const updated = { id: 'e1', status: 'running', totalPolicies: 10 }
      mockDb.returning.mockResolvedValueOnce([updated])

      const result = await executionService.updateStatus('e1', 'running', {
        totalPolicies: 10,
        successCount: 5,
      })

      expect(result).toEqual(updated)
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'running',
          totalPolicies: 10,
          successCount: 5,
        }),
      )
    })

    it('sets completedAt for completed status', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'e1', status: 'completed' }])

      await executionService.updateStatus('e1', 'completed')

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          completedAt: expect.any(Date),
        }),
      )
    })

    it('sets completedAt for failed status', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'e1', status: 'failed' }])

      await executionService.updateStatus('e1', 'failed')

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          completedAt: expect.any(Date),
        }),
      )
    })

    it('sets completedAt for cancelled status', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'e1', status: 'cancelled' }])

      await executionService.updateStatus('e1', 'cancelled')

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
          completedAt: expect.any(Date),
        }),
      )
    })

    it('does not set completedAt for running status', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'e1' }])

      await executionService.updateStatus('e1', 'running')

      const setArg = mockDb.set.mock.calls[0][0]
      expect(setArg.completedAt).toBeUndefined()
    })
  })

  describe('findByUser', () => {
    it('returns executions for a user without date filter', async () => {
      const executions = [{ id: 'e1' }, { id: 'e2' }]
      mockDb.offset.mockResolvedValueOnce(executions)

      const result = await executionService.findByUser('u1')

      expect(result).toEqual(executions)
      expect(mockDb.select).toHaveBeenCalled()
      expect(mockDb.limit).toHaveBeenCalledWith(50)
      expect(mockDb.offset).toHaveBeenCalledWith(0)
    })

    it('applies date filter when executionDate is provided', async () => {
      mockDb.offset.mockResolvedValueOnce([])

      await executionService.findByUser('u1', '2026-01-15')

      expect(mockDb.where).toHaveBeenCalled()
    })

    it('respects custom limit and offset', async () => {
      mockDb.offset.mockResolvedValueOnce([])

      await executionService.findByUser('u1', undefined, 10, 20)

      expect(mockDb.limit).toHaveBeenCalledWith(10)
      expect(mockDb.offset).toHaveBeenCalledWith(20)
    })
  })

  describe('findById', () => {
    it('returns execution when found', async () => {
      const exec = { id: 'e1', astName: 'ast1' }
      mockDb.limit.mockResolvedValueOnce([exec])

      const result = await executionService.findById('e1')

      expect(result).toEqual(exec)
    })

    it('returns null when not found', async () => {
      mockDb.limit.mockResolvedValueOnce([undefined])

      const result = await executionService.findById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('batchInsertPolicies', () => {
    it('returns early when items array is empty', async () => {
      await executionService.batchInsertPolicies('e1', [])

      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it('inserts policy results and updates execution counts', async () => {
      const items = [
        { policyNumber: 'P001', status: 'success' as const, durationMs: 100 },
        { policyNumber: 'P002', status: 'failure' as const, durationMs: 200, error: 'fail reason' },
        { policyNumber: 'P003', status: 'error' as const, durationMs: 50, data: { detail: 'x' } },
      ]

      // insert call resolves (no returning)
      mockDb.values.mockResolvedValueOnce(undefined)

      await executionService.batchInsertPolicies('e1', items)

      // First insert is for policyResults
      expect(mockDb.insert).toHaveBeenCalled()
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ executionId: 'e1', policyNumber: 'P001', status: 'success' }),
          expect.objectContaining({ executionId: 'e1', policyNumber: 'P002', status: 'failure', error: 'fail reason' }),
          expect.objectContaining({ executionId: 'e1', policyNumber: 'P003', status: 'error' }),
        ]),
      )

      // Second call is update for counts
      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  describe('getPolicies', () => {
    it('returns policies without status filter', async () => {
      const policies = [{ id: 'p1' }, { id: 'p2' }]
      mockDb.offset.mockResolvedValueOnce(policies)

      const result = await executionService.getPolicies('e1')

      expect(result).toEqual(policies)
      expect(mockDb.limit).toHaveBeenCalledWith(100)
      expect(mockDb.offset).toHaveBeenCalledWith(0)
    })

    it('applies status filter when provided', async () => {
      mockDb.offset.mockResolvedValueOnce([])

      await executionService.getPolicies('e1', 'success')

      expect(mockDb.where).toHaveBeenCalled()
    })

    it('respects custom limit and offset', async () => {
      mockDb.offset.mockResolvedValueOnce([])

      await executionService.getPolicies('e1', undefined, 25, 10)

      expect(mockDb.limit).toHaveBeenCalledWith(25)
      expect(mockDb.offset).toHaveBeenCalledWith(10)
    })
  })
})
