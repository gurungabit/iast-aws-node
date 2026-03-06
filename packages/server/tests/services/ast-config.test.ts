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

vi.mock('@src/db/index.js', () => ({ db: mockDb }))
vi.mock('@src/db/schema/index.js', () => ({
  astConfigs: { id: 'id', ownerId: 'ownerId', astName: 'astName', visibility: 'visibility' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => val),
  and: vi.fn((...args: unknown[]) => args),
  or: vi.fn((...args: unknown[]) => args),
}))

import { astConfigService } from '@src/services/ast-config.js'

describe('astConfigService', () => {
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
    it('inserts a new config with provided data', async () => {
      const config = { id: 'c1', astName: 'ast1', name: 'Config 1', visibility: 'private' }
      mockDb.returning.mockResolvedValueOnce([config])

      const result = await astConfigService.create({
        astName: 'ast1',
        ownerId: 'u1',
        name: 'Config 1',
      })

      expect(result).toEqual(config)
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          astName: 'ast1',
          ownerId: 'u1',
          name: 'Config 1',
          visibility: 'private',
          params: {},
          tasks: [],
        }),
      )
    })

    it('uses provided visibility and params', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'c2' }])

      await astConfigService.create({
        astName: 'ast2',
        ownerId: 'u1',
        name: 'Public Config',
        visibility: 'public',
        params: { key: 'val' },
        tasks: [{ step: 1 }],
      })

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'public',
          params: { key: 'val' },
          tasks: [{ step: 1 }],
        }),
      )
    })
  })

  describe('findVisible', () => {
    it('returns own and public configs', async () => {
      const configs = [{ id: 'c1' }, { id: 'c2' }]
      mockDb.where.mockResolvedValueOnce(configs)

      const result = await astConfigService.findVisible('u1')

      expect(result).toEqual(configs)
      expect(mockDb.select).toHaveBeenCalled()
    })

    it('includes astName filter when provided', async () => {
      mockDb.where.mockResolvedValueOnce([])

      await astConfigService.findVisible('u1', 'specific-ast')

      expect(mockDb.where).toHaveBeenCalled()
    })

    it('returns empty array when no configs match', async () => {
      mockDb.where.mockResolvedValueOnce([])

      const result = await astConfigService.findVisible('u1')

      expect(result).toEqual([])
    })
  })

  describe('findById', () => {
    it('returns config when found', async () => {
      const config = { id: 'c1', name: 'My Config' }
      mockDb.limit.mockResolvedValueOnce([config])

      const result = await astConfigService.findById('c1')

      expect(result).toEqual(config)
    })

    it('returns null when not found', async () => {
      mockDb.limit.mockResolvedValueOnce([undefined])

      const result = await astConfigService.findById('missing')

      expect(result).toBeNull()
    })
  })

  describe('update', () => {
    it('updates config and returns it', async () => {
      const updated = { id: 'c1', name: 'Updated' }
      mockDb.returning.mockResolvedValueOnce([updated])

      const result = await astConfigService.update('c1', 'u1', { name: 'Updated' })

      expect(result).toEqual(updated)
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated', updatedAt: expect.any(Date) }),
      )
    })

    it('returns null when config not found or not owned', async () => {
      mockDb.returning.mockResolvedValueOnce([undefined])

      const result = await astConfigService.update('missing', 'u1', { name: 'X' })

      expect(result).toBeNull()
    })
  })

  describe('remove', () => {
    it('returns true when config is deleted', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'c1' }])

      const result = await astConfigService.remove('c1', 'u1')

      expect(result).toBe(true)
    })

    it('returns false when config not found', async () => {
      mockDb.returning.mockResolvedValueOnce([])

      const result = await astConfigService.remove('nonexistent', 'u1')

      expect(result).toBe(false)
    })
  })

  describe('clone', () => {
    it('clones an existing config with a new name and private visibility', async () => {
      const original = {
        id: 'c1',
        astName: 'ast1',
        name: 'Original',
        visibility: 'public',
        params: { key: 'val' },
        tasks: [{ step: 1 }],
      }
      const cloned = { id: 'c2', astName: 'ast1', name: 'Cloned', visibility: 'private' }

      // findById call
      mockDb.limit.mockResolvedValueOnce([original])
      // create call
      mockDb.returning.mockResolvedValueOnce([cloned])

      const result = await astConfigService.clone('c1', 'u2', 'Cloned')

      expect(result).toEqual(cloned)
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          astName: 'ast1',
          ownerId: 'u2',
          name: 'Cloned',
          visibility: 'private',
          params: { key: 'val' },
          tasks: [{ step: 1 }],
        }),
      )
    })

    it('returns null when original config not found', async () => {
      mockDb.limit.mockResolvedValueOnce([undefined])

      const result = await astConfigService.clone('nonexistent', 'u1', 'New Name')

      expect(result).toBeNull()
      expect(mockDb.insert).not.toHaveBeenCalled()
    })
  })
})
