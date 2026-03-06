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

import {
  listAstConfigs,
  getAstConfig,
  createAstConfig,
  updateAstConfig,
  deleteAstConfig,
  cloneAstConfig,
  runAstConfig,
} from './ast-configs'

describe('ast-configs service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listAstConfigs', () => {
    it('calls apiGet with astName and default scope', async () => {
      mockApiGet.mockResolvedValue([])
      await listAstConfigs('login')
      expect(mockApiGet).toHaveBeenCalledWith('/ast-configs?astName=login&scope=all')
    })

    it('calls apiGet with specified scope', async () => {
      mockApiGet.mockResolvedValue([])
      await listAstConfigs('login', 'mine')
      expect(mockApiGet).toHaveBeenCalledWith('/ast-configs?astName=login&scope=mine')
    })

    it('returns the list of configs', async () => {
      const configs = [{ id: '1', astName: 'login' }]
      mockApiGet.mockResolvedValue(configs)
      const result = await listAstConfigs('login')
      expect(result).toEqual(configs)
    })
  })

  describe('getAstConfig', () => {
    it('calls apiGet with astName and configId', async () => {
      mockApiGet.mockResolvedValue({ id: '1' })
      await getAstConfig('login', '1')
      expect(mockApiGet).toHaveBeenCalledWith('/ast-configs/login/1')
    })
  })

  describe('createAstConfig', () => {
    it('calls apiPost with /ast-configs', async () => {
      const data = {
        astName: 'login',
        category: 'fire',
        configurationName: 'My Config',
        oc: '01',
        parallel: false,
        testMode: false,
        visibility: 'private',
        params: {},
      }
      mockApiPost.mockResolvedValue({ configId: '1', ...data })
      const result = await createAstConfig(data)
      expect(mockApiPost).toHaveBeenCalledWith('/ast-configs', data)
      expect(result.configId).toBe('1')
    })
  })

  describe('updateAstConfig', () => {
    it('calls apiPatch with astName and configId', async () => {
      const data = { configurationName: 'Updated' }
      mockApiPatch.mockResolvedValue({ id: '1' })
      await updateAstConfig('login', '1', data)
      expect(mockApiPatch).toHaveBeenCalledWith('/ast-configs/login/1', data)
    })
  })

  describe('deleteAstConfig', () => {
    it('calls apiDelete with astName and configId', async () => {
      mockApiDelete.mockResolvedValue(undefined)
      await deleteAstConfig('login', '1')
      expect(mockApiDelete).toHaveBeenCalledWith('/ast-configs/login/1')
    })
  })

  describe('cloneAstConfig', () => {
    it('calls apiPost with clone endpoint', async () => {
      mockApiPost.mockResolvedValue({ id: '2' })
      await cloneAstConfig('login', '1', { configurationName: 'Clone' })
      expect(mockApiPost).toHaveBeenCalledWith('/ast-configs/login/1/clone', {
        configurationName: 'Clone',
      })
    })
  })

  describe('runAstConfig', () => {
    it('calls apiPost with run endpoint', async () => {
      const data = {
        username: 'user',
        password: 'pass',
        sessionId: 'sess-1',
        userLocalDate: '2026-01-01',
      }
      mockApiPost.mockResolvedValue({ runId: 'run-1', taskCount: 1 })
      const result = await runAstConfig('login', '1', data)
      expect(mockApiPost).toHaveBeenCalledWith('/ast-configs/login/1/run', data)
      expect(result.runId).toBe('run-1')
    })
  })
})
