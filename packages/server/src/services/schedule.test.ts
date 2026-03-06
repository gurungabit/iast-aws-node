import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
}))

vi.mock('../db/index.js', () => ({ db: mockDb }))
vi.mock('../db/schema/index.js', () => ({
  schedules: { id: 'id', userId: 'userId' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => val),
  and: vi.fn((...args: unknown[]) => args),
}))

import { scheduleService } from './schedule.js'

describe('scheduleService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.delete.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.limit.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.values.mockReturnThis()
  })

  describe('create', () => {
    it('inserts a new schedule with defaults', async () => {
      const schedule = { id: 'sch1', userId: 'u1', astName: 'ast1', status: 'pending' }
      mockDb.returning.mockResolvedValueOnce([schedule])

      const result = await scheduleService.create({
        userId: 'u1',
        astName: 'ast1',
        scheduledTime: new Date('2026-06-01T10:00:00Z'),
      })

      expect(result).toEqual(schedule)
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          astName: 'ast1',
          scheduledTime: new Date('2026-06-01T10:00:00Z'),
          params: {},
          encryptedCredentials: null,
        }),
      )
    })

    it('uses provided params and encryptedCredentials', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'sch2' }])

      await scheduleService.create({
        userId: 'u1',
        astName: 'ast1',
        scheduledTime: new Date('2026-06-01T10:00:00Z'),
        params: { region: 'us-east-1' },
        encryptedCredentials: { userId: 'enc', password: 'enc' },
      })

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { region: 'us-east-1' },
          encryptedCredentials: { userId: 'enc', password: 'enc' },
        }),
      )
    })
  })

  describe('findByUser', () => {
    it('returns schedules for the user', async () => {
      const schedules = [{ id: 'sch1' }, { id: 'sch2' }]
      mockDb.where.mockResolvedValueOnce(schedules)

      const result = await scheduleService.findByUser('u1')

      expect(result).toEqual(schedules)
      expect(mockDb.select).toHaveBeenCalled()
    })
  })

  describe('findById', () => {
    it('returns schedule when found', async () => {
      const schedule = { id: 'sch1', astName: 'ast1' }
      mockDb.limit.mockResolvedValueOnce([schedule])

      const result = await scheduleService.findById('sch1')

      expect(result).toEqual(schedule)
    })

    it('returns null when not found', async () => {
      mockDb.limit.mockResolvedValueOnce([undefined])

      const result = await scheduleService.findById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('updateStatus', () => {
    it('updates status and returns schedule', async () => {
      const schedule = { id: 'sch1', status: 'confirmed' }
      mockDb.returning.mockResolvedValueOnce([schedule])

      const result = await scheduleService.updateStatus('sch1', 'confirmed')

      expect(result).toEqual(schedule)
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'confirmed', updatedAt: expect.any(Date) }),
      )
    })

    it('includes eventBridgeScheduleName when provided', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'sch1' }])

      await scheduleService.updateStatus('sch1', 'active', 'eb-sched-123')

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          eventBridgeScheduleName: 'eb-sched-123',
          updatedAt: expect.any(Date),
        }),
      )
    })

    it('does not include eventBridgeScheduleName when not provided', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'sch1' }])

      await scheduleService.updateStatus('sch1', 'active')

      const setArg = mockDb.set.mock.calls[0][0]
      expect(setArg.eventBridgeScheduleName).toBeUndefined()
    })

    it('returns null when schedule not found', async () => {
      mockDb.returning.mockResolvedValueOnce([undefined])

      const result = await scheduleService.updateStatus('missing', 'active')

      expect(result).toBeNull()
    })
  })

  describe('remove', () => {
    it('returns true when schedule is deleted', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'sch1' }])

      const result = await scheduleService.remove('sch1', 'u1')

      expect(result).toBe(true)
      expect(mockDb.delete).toHaveBeenCalled()
    })

    it('returns false when schedule not found', async () => {
      mockDb.returning.mockResolvedValueOnce([])

      const result = await scheduleService.remove('nonexistent', 'u1')

      expect(result).toBe(false)
    })
  })
})
