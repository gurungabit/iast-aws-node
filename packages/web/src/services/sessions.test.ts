import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockApiGet, mockApiPost, mockApiPatch, mockApiDelete } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiDelete: vi.fn(),
}))

vi.mock('./api', () => ({
  apiGet: mockApiGet,
  apiPost: mockApiPost,
  apiPatch: mockApiPatch,
  apiDelete: mockApiDelete,
}))

import { getSessions, createSession, renameSession, deleteSession } from './sessions'

describe('sessions service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSessions', () => {
    it('calls apiGet with /sessions', async () => {
      const sessions = [{ id: '1', name: 'Session 1', createdAt: '2025-01-01' }]
      mockApiGet.mockResolvedValue(sessions)

      const result = await getSessions()

      expect(mockApiGet).toHaveBeenCalledWith('/sessions')
      expect(result).toEqual(sessions)
    })

    it('returns empty array when no sessions exist', async () => {
      mockApiGet.mockResolvedValue([])

      const result = await getSessions()

      expect(result).toEqual([])
    })
  })

  describe('createSession', () => {
    it('calls apiPost with /sessions and name', async () => {
      const session = { id: '1', name: 'My Session', createdAt: '2025-01-01' }
      mockApiPost.mockResolvedValue(session)

      const result = await createSession('My Session')

      expect(mockApiPost).toHaveBeenCalledWith('/sessions', { name: 'My Session' })
      expect(result).toEqual(session)
    })

    it('calls apiPost with undefined name when not provided', async () => {
      const session = { id: '1', name: 'Untitled', createdAt: '2025-01-01' }
      mockApiPost.mockResolvedValue(session)

      const result = await createSession()

      expect(mockApiPost).toHaveBeenCalledWith('/sessions', { name: undefined })
      expect(result).toEqual(session)
    })
  })

  describe('renameSession', () => {
    it('calls apiPatch with /sessions/:id and new name', async () => {
      const session = { id: '1', name: 'Renamed', createdAt: '2025-01-01' }
      mockApiPatch.mockResolvedValue(session)

      const result = await renameSession('1', 'Renamed')

      expect(mockApiPatch).toHaveBeenCalledWith('/sessions/1', { name: 'Renamed' })
      expect(result).toEqual(session)
    })

    it('passes the correct session id in the path', async () => {
      mockApiPatch.mockResolvedValue({})

      await renameSession('abc-123', 'Test')

      expect(mockApiPatch).toHaveBeenCalledWith('/sessions/abc-123', { name: 'Test' })
    })
  })

  describe('deleteSession', () => {
    it('calls apiDelete with /sessions/:id', async () => {
      mockApiDelete.mockResolvedValue(undefined)

      await deleteSession('1')

      expect(mockApiDelete).toHaveBeenCalledWith('/sessions/1')
    })

    it('passes the correct session id in the path', async () => {
      mockApiDelete.mockResolvedValue(undefined)

      await deleteSession('xyz-789')

      expect(mockApiDelete).toHaveBeenCalledWith('/sessions/xyz-789')
    })
  })
})
