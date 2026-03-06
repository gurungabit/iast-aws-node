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

import { getSchedules, createSchedule, cancelSchedule, runScheduleNow } from './schedules'

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
      const schedules = [{ id: '1', astName: 'login', status: 'pending' }]
      mockApiGet.mockResolvedValue(schedules)
      const result = await getSchedules()
      expect(result).toEqual(schedules)
    })
  })

  describe('createSchedule', () => {
    it('calls apiPost with /schedules', async () => {
      const data = {
        astName: 'login',
        scheduledTime: '2026-06-01T10:00:00Z',
        timezone: 'America/New_York',
        credentials: { username: 'user', password: 'pass' },
        params: {},
      }
      mockApiPost.mockResolvedValue({ scheduleId: 'sched-1' })
      const result = await createSchedule(data)
      expect(mockApiPost).toHaveBeenCalledWith('/schedules', data)
      expect(result.scheduleId).toBe('sched-1')
    })
  })

  describe('cancelSchedule', () => {
    it('calls apiDelete with /schedules/:id', async () => {
      mockApiDelete.mockResolvedValue(undefined)
      await cancelSchedule('sched-1')
      expect(mockApiDelete).toHaveBeenCalledWith('/schedules/sched-1')
    })
  })

  describe('runScheduleNow', () => {
    it('calls apiPost with /schedules/:id/run', async () => {
      mockApiPost.mockResolvedValue(undefined)
      await runScheduleNow('sched-1')
      expect(mockApiPost).toHaveBeenCalledWith('/schedules/sched-1/run')
    })
  })
})
