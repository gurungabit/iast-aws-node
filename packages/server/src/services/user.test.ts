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
  users: { id: 'id', email: 'email', entraId: 'entraId' },
}))
vi.mock('drizzle-orm', () => ({ eq: vi.fn((_col, val) => val) }))

import { userService } from './user.js'

describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset chainable mocks
    mockDb.select.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.update.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.limit.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.values.mockReturnThis()
  })

  describe('findOrCreate', () => {
    const verified = {
      sub: 'sub-1',
      email: 'test@example.com',
      name: 'Test User',
      oid: 'oid-1',
    }

    it('returns existing user when found and name matches', async () => {
      const existingUser = { id: 'u1', displayName: 'Test User', entraId: 'oid-1' }
      mockDb.limit.mockResolvedValueOnce([existingUser])

      const result = await userService.findOrCreate(verified)

      expect(result).toEqual(existingUser)
      expect(mockDb.select).toHaveBeenCalled()
      expect(mockDb.update).not.toHaveBeenCalled()
      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it('updates displayName when existing user has a different name', async () => {
      const existingUser = { id: 'u1', displayName: 'Old Name', entraId: 'oid-1' }
      mockDb.limit.mockResolvedValueOnce([existingUser])

      const result = await userService.findOrCreate(verified)

      expect(result).toEqual(existingUser)
      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Test User' }),
      )
    })

    it('creates a new user when not found', async () => {
      const newUser = { id: 'u2', email: 'test@example.com', displayName: 'Test User', entraId: 'oid-1' }
      mockDb.limit.mockResolvedValueOnce([])
      mockDb.returning.mockResolvedValueOnce([newUser])

      const result = await userService.findOrCreate(verified)

      expect(result).toEqual(newUser)
      expect(mockDb.insert).toHaveBeenCalled()
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          displayName: 'Test User',
          entraId: 'oid-1',
          alias: 'test',
        }),
      )
    })

    it('derives alias from email prefix when creating a new user', async () => {
      const customVerified = { ...verified, email: 'john.doe@company.com' }
      mockDb.limit.mockResolvedValueOnce([])
      mockDb.returning.mockResolvedValueOnce([{ id: 'u3' }])

      await userService.findOrCreate(customVerified)

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({ alias: 'john.doe' }),
      )
    })
  })

  describe('findById', () => {
    it('returns the user when found', async () => {
      const user = { id: 'u1', email: 'test@example.com' }
      mockDb.limit.mockResolvedValueOnce([user])

      const result = await userService.findById('u1')

      expect(result).toEqual(user)
    })

    it('returns null when user not found', async () => {
      mockDb.limit.mockResolvedValueOnce([undefined])

      const result = await userService.findById('nonexistent')

      expect(result).toBeNull()
    })

    it('returns null when result array is destructured to undefined', async () => {
      mockDb.limit.mockResolvedValueOnce([])

      const result = await userService.findById('missing')

      expect(result).toBeNull()
    })
  })

  describe('findByEmail', () => {
    it('returns the user when found by email', async () => {
      const user = { id: 'u1', email: 'test@example.com' }
      mockDb.limit.mockResolvedValueOnce([user])

      const result = await userService.findByEmail('test@example.com')

      expect(result).toEqual(user)
    })

    it('returns null when email not found', async () => {
      mockDb.limit.mockResolvedValueOnce([undefined])

      const result = await userService.findByEmail('noone@example.com')

      expect(result).toBeNull()
    })
  })

  describe('updateAlias', () => {
    it('updates the alias and returns the updated user', async () => {
      const updatedUser = { id: 'u1', alias: 'new-alias' }
      mockDb.returning.mockResolvedValueOnce([updatedUser])

      const result = await userService.updateAlias('u1', 'new-alias')

      expect(result).toEqual(updatedUser)
      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ alias: 'new-alias' }),
      )
    })

    it('passes a Date for updatedAt', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'u1' }])

      await userService.updateAlias('u1', 'alias')

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ updatedAt: expect.any(Date) }),
      )
    })
  })
})
