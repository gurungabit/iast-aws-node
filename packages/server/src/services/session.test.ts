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
  sessions: { id: 'id', userId: 'userId' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => val),
  and: vi.fn((...args: unknown[]) => args),
}))

import { sessionService } from './session.js'

describe('sessionService', () => {
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
    it('inserts a new session and returns it', async () => {
      const session = { id: 'ses_abc', userId: 'u1', name: 'My Session' }
      mockDb.returning.mockResolvedValueOnce([session])

      const result = await sessionService.create('ses_abc', 'u1', 'My Session')

      expect(result).toEqual(session)
      expect(mockDb.insert).toHaveBeenCalled()
      expect(mockDb.values).toHaveBeenCalledWith({
        id: 'ses_abc',
        userId: 'u1',
        name: 'My Session',
      })
    })

    it('defaults name to empty string', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'ses_abc' }])

      await sessionService.create('ses_abc', 'u1')

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({ name: '' }),
      )
    })
  })

  describe('findByUser', () => {
    it('returns sessions for the given user', async () => {
      const sessions = [{ id: 's1' }, { id: 's2' }]
      mockDb.where.mockResolvedValueOnce(sessions)

      const result = await sessionService.findByUser('u1')

      expect(result).toEqual(sessions)
      expect(mockDb.select).toHaveBeenCalled()
    })
  })

  describe('findById', () => {
    it('returns session when found', async () => {
      const session = { id: 's1', name: 'Test' }
      mockDb.limit.mockResolvedValueOnce([session])

      const result = await sessionService.findById('s1')

      expect(result).toEqual(session)
    })

    it('returns null when not found', async () => {
      mockDb.limit.mockResolvedValueOnce([undefined])

      const result = await sessionService.findById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('rename', () => {
    it('updates session name and returns it', async () => {
      const session = { id: 's1', name: 'New Name' }
      mockDb.returning.mockResolvedValueOnce([session])

      const result = await sessionService.rename('s1', 'u1', 'New Name')

      expect(result).toEqual(session)
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Name', updatedAt: expect.any(Date) }),
      )
    })

    it('returns null when session not found (no match)', async () => {
      mockDb.returning.mockResolvedValueOnce([undefined])

      const result = await sessionService.rename('nonexistent', 'u1', 'Name')

      expect(result).toBeNull()
    })

    it('returns null when session belongs to different user', async () => {
      mockDb.returning.mockResolvedValueOnce([])

      const result = await sessionService.rename('s1', 'wrong-user', 'Name')

      expect(result).toBeNull()
    })
  })

  describe('remove', () => {
    it('returns true when session is successfully deleted', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 's1' }])

      const result = await sessionService.remove('s1', 'u1')

      expect(result).toBe(true)
      expect(mockDb.delete).toHaveBeenCalled()
    })

    it('returns false when session not found', async () => {
      mockDb.returning.mockResolvedValueOnce([])

      const result = await sessionService.remove('nonexistent', 'u1')

      expect(result).toBe(false)
    })
  })
})
