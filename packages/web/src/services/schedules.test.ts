import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockApiGet, mockApiPost, mockApiDelete } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiDelete: vi.fn(),
}))

vi.mock('./api', () => ({
  apiGet: mockApiGet,
  apiPost: mockApiPost,
  apiDelete: mockApiDelete,
}))

import { getSchedules, createSchedule, deleteSchedule } from './schedules'

describe('schedules service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSchedules', () => {
    it('calls apiGet with /schedules', async () => {
      mockApiGet.mockResolvedValue([])

      await getSchedules()

      expect(mockApiGet).toHaveBeenCalledWith('/schedules')
    })

    it('returns the list of schedules', async () => {
      const schedules = [
        { id: '1', astName: 'LoginAST', scheduledTime: '2025-06-01T10:00:00Z', status: 'pending' },
      ]
      mockApiGet.mockResolvedValue(schedules)

      const result = await getSchedules()

      expect(result).toEqual(schedules)
    })

    it('returns empty array when no schedules exist', async () => {
      mockApiGet.mockResolvedValue([])

      const result = await getSchedules()

      expect(result).toEqual([])
    })
  })

  describe('createSchedule', () => {
    it('calls apiPost with /schedules and required data', async () => {
      const data = { astName: 'LoginAST', scheduledTime: '2025-06-01T10:00:00Z' }
      const created = { id: '1', ...data, status: 'pending', createdAt: '2025-01-01' }
      mockApiPost.mockResolvedValue(created)

      const result = await createSchedule(data)

      expect(mockApiPost).toHaveBeenCalledWith('/schedules', data)
      expect(result).toEqual(created)
    })

    it('includes optional params when provided', async () => {
      const data = {
        astName: 'LoginAST',
        scheduledTime: '2025-06-01T10:00:00Z',
        params: { timeout: 60 },
      }
      mockApiPost.mockResolvedValue({ id: '1', ...data })

      await createSchedule(data)

      expect(mockApiPost).toHaveBeenCalledWith('/schedules', data)
    })

    it('includes optional credentials when provided', async () => {
      const data = {
        astName: 'LoginAST',
        scheduledTime: '2025-06-01T10:00:00Z',
        credentials: { userId: 'user1', password: 'pass123' },
      }
      mockApiPost.mockResolvedValue({ id: '1', ...data })

      await createSchedule(data)

      expect(mockApiPost).toHaveBeenCalledWith('/schedules', data)
    })
  })

  describe('deleteSchedule', () => {
    it('calls apiDelete with /schedules/:id', async () => {
      mockApiDelete.mockResolvedValue(undefined)

      await deleteSchedule('1')

      expect(mockApiDelete).toHaveBeenCalledWith('/schedules/1')
    })

    it('passes the correct schedule id in the path', async () => {
      mockApiDelete.mockResolvedValue(undefined)

      await deleteSchedule('sched-abc-123')

      expect(mockApiDelete).toHaveBeenCalledWith('/schedules/sched-abc-123')
    })

    it('returns void', async () => {
      mockApiDelete.mockResolvedValue(undefined)

      const result = await deleteSchedule('1')

      expect(result).toBeUndefined()
    })
  })
})
