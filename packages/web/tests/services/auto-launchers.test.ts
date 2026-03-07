import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockApiGet, mockApiPost, mockApiPatch, mockApiDelete } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiDelete: vi.fn(),
}))

vi.mock('@src/services/api', () => ({
  apiGet: mockApiGet,
  apiPost: mockApiPost,
  apiPatch: mockApiPatch,
  apiDelete: mockApiDelete,
}))

import {
  getAutoLaunchers,
  createAutoLauncher,
  updateAutoLauncher,
  deleteAutoLauncher,
  runAutoLauncher,
  getAutoLauncherRuns,
} from '@src/services/auto-launchers'

describe('auto-launchers service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAutoLaunchers', () => {
    it('calls apiGet with /auto-launchers', async () => {
      mockApiGet.mockResolvedValue([])

      await getAutoLaunchers()

      expect(mockApiGet).toHaveBeenCalledWith('/auto-launchers')
    })

    it('returns the list of auto launchers', async () => {
      const launchers = [{ id: '1', name: 'Launcher 1', visibility: 'public', steps: [] }]
      mockApiGet.mockResolvedValue(launchers)

      const result = await getAutoLaunchers()

      expect(result).toEqual(launchers)
    })
  })

  describe('createAutoLauncher', () => {
    it('calls apiPost with /auto-launchers and data', async () => {
      const data = { name: 'New Launcher' }
      const created = { id: '1', ...data }
      mockApiPost.mockResolvedValue(created)

      const result = await createAutoLauncher(data)

      expect(mockApiPost).toHaveBeenCalledWith('/auto-launchers', data)
      expect(result).toEqual(created)
    })

    it('includes optional fields when provided', async () => {
      const data = {
        name: 'Launcher',
        visibility: 'private',
        steps: [{ type: 'run', config: 'abc' }],
      }
      mockApiPost.mockResolvedValue({ id: '1', ...data })

      await createAutoLauncher(data)

      expect(mockApiPost).toHaveBeenCalledWith('/auto-launchers', data)
    })
  })

  describe('updateAutoLauncher', () => {
    it('calls apiPatch with /auto-launchers/:id and data', async () => {
      const data = { name: 'Updated Launcher' }
      mockApiPatch.mockResolvedValue({ id: '1', name: 'Updated Launcher' })

      const result = await updateAutoLauncher('1', data)

      expect(mockApiPatch).toHaveBeenCalledWith('/auto-launchers/1', data)
      expect(result).toEqual({ id: '1', name: 'Updated Launcher' })
    })

    it('passes the correct id in the path', async () => {
      mockApiPatch.mockResolvedValue({})

      await updateAutoLauncher('abc-123', { visibility: 'private' })

      expect(mockApiPatch).toHaveBeenCalledWith('/auto-launchers/abc-123', {
        visibility: 'private',
      })
    })
  })

  describe('deleteAutoLauncher', () => {
    it('calls apiDelete with /auto-launchers/:id', async () => {
      mockApiDelete.mockResolvedValue(undefined)

      await deleteAutoLauncher('1')

      expect(mockApiDelete).toHaveBeenCalledWith('/auto-launchers/1')
    })

    it('passes the correct id in the path', async () => {
      mockApiDelete.mockResolvedValue(undefined)

      await deleteAutoLauncher('xyz-789')

      expect(mockApiDelete).toHaveBeenCalledWith('/auto-launchers/xyz-789')
    })
  })

  describe('runAutoLauncher', () => {
    it('calls apiPost with /auto-launchers/:id/run and data', async () => {
      const runResult = {
        runId: 'run-1',
        sessionId: 'session-1',
        steps: [{ astName: 'login', configId: 'c1', order: 0 }],
      }
      mockApiPost.mockResolvedValue(runResult)

      const data = {
        sessionId: 'session-1',
        username: 'USER1',
        password: 'pass',
        userLocalDate: '2025-01-01',
      }

      const result = await runAutoLauncher('launcher-1', data)

      expect(mockApiPost).toHaveBeenCalledWith('/auto-launchers/launcher-1/run', data)
      expect(result).toEqual(runResult)
    })

    it('passes the correct launcher id in the path', async () => {
      mockApiPost.mockResolvedValue({ runId: 'r1', sessionId: 's1', steps: [] })

      await runAutoLauncher('abc-123', {
        sessionId: 's1',
        username: 'U',
        password: 'P',
      })

      expect(mockApiPost).toHaveBeenCalledWith('/auto-launchers/abc-123/run', expect.any(Object))
    })
  })

  describe('getAutoLauncherRuns', () => {
    it('calls apiGet with default limit and offset', async () => {
      mockApiGet.mockResolvedValue([])

      await getAutoLauncherRuns()

      expect(mockApiGet).toHaveBeenCalledWith('/auto-launcher-runs?limit=50&offset=0')
    })

    it('calls apiGet with custom limit and offset', async () => {
      mockApiGet.mockResolvedValue([])

      await getAutoLauncherRuns(25, 10)

      expect(mockApiGet).toHaveBeenCalledWith('/auto-launcher-runs?limit=25&offset=10')
    })

    it('returns the list of auto launcher runs', async () => {
      const runs = [
        {
          id: 'r1',
          launcherId: '1',
          status: 'completed',
          steps: [],
          currentStepIndex: '2',
          createdAt: '2025-01-01',
          completedAt: '2025-01-01',
        },
      ]
      mockApiGet.mockResolvedValue(runs)

      const result = await getAutoLauncherRuns()

      expect(result).toEqual(runs)
    })
  })
})
