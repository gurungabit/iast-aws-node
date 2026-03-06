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
  listAstConfigs,
  getAstConfig,
  createAstConfig,
  updateAstConfig,
  deleteAstConfig,
  cloneAstConfig,
  runAstConfig,
} from '@src/services/ast-configs'

const serverConfig = {
  id: '1',
  astName: 'login',
  ownerId: 'user-1',
  name: 'My Config',
  visibility: 'private',
  params: { oc: '01', parallel: false, testMode: false },
  tasks: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('ast-configs service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listAstConfigs', () => {
    it('calls apiGet with astName query param', async () => {
      mockApiGet.mockResolvedValue([serverConfig])
      await listAstConfigs('login')
      expect(mockApiGet).toHaveBeenCalledWith('/ast-configs?astName=login')
    })

    it('calls apiGet without query when no astName', async () => {
      mockApiGet.mockResolvedValue([])
      await listAstConfigs()
      expect(mockApiGet).toHaveBeenCalledWith('/ast-configs')
    })

    it('maps server fields to client fields', async () => {
      mockApiGet.mockResolvedValue([serverConfig])
      const result = await listAstConfigs('login')
      expect(result[0].configId).toBe('1')
      expect(result[0].configurationName).toBe('My Config')
      expect(result[0].astName).toBe('login')
    })
  })

  describe('getAstConfig', () => {
    it('calls apiGet with configId', async () => {
      mockApiGet.mockResolvedValue(serverConfig)
      await getAstConfig('1')
      expect(mockApiGet).toHaveBeenCalledWith('/ast-configs/1')
    })

    it('maps server fields to client fields', async () => {
      mockApiGet.mockResolvedValue(serverConfig)
      const result = await getAstConfig('1')
      expect(result.configId).toBe('1')
      expect(result.configurationName).toBe('My Config')
    })
  })

  describe('createAstConfig', () => {
    it('maps configurationName to name and merges oc/parallel/testMode into params', async () => {
      mockApiPost.mockResolvedValue(serverConfig)
      await createAstConfig({
        astName: 'login',
        configurationName: 'My Config',
        visibility: 'private',
        oc: '01',
        parallel: false,
        testMode: true,
        params: { customField: 'value' },
      })
      expect(mockApiPost).toHaveBeenCalledWith('/ast-configs', {
        astName: 'login',
        name: 'My Config',
        visibility: 'private',
        params: { customField: 'value', oc: '01', parallel: false, testMode: true },
        tasks: undefined,
      })
    })

    it('returns mapped config', async () => {
      mockApiPost.mockResolvedValue(serverConfig)
      const result = await createAstConfig({
        astName: 'login',
        configurationName: 'My Config',
      })
      expect(result.configId).toBe('1')
      expect(result.configurationName).toBe('My Config')
    })
  })

  describe('updateAstConfig', () => {
    it('maps configurationName to name and merges oc/parallel/testMode into params', async () => {
      mockApiPatch.mockResolvedValue(serverConfig)
      await updateAstConfig('login', '1', {
        configurationName: 'Updated',
        oc: '02',
        parallel: true,
        testMode: false,
        params: { someParam: 'x' },
      })
      expect(mockApiPatch).toHaveBeenCalledWith('/ast-configs/1', {
        name: 'Updated',
        visibility: undefined,
        params: { someParam: 'x', oc: '02', parallel: true, testMode: false },
        tasks: undefined,
      })
    })
  })

  describe('deleteAstConfig', () => {
    it('calls apiDelete with configId', async () => {
      mockApiDelete.mockResolvedValue(undefined)
      await deleteAstConfig('login', '1')
      expect(mockApiDelete).toHaveBeenCalledWith('/ast-configs/1')
    })
  })

  describe('cloneAstConfig', () => {
    it('maps configurationName to name in clone request', async () => {
      mockApiPost.mockResolvedValue(serverConfig)
      await cloneAstConfig('login', '1', { configurationName: 'Clone' })
      expect(mockApiPost).toHaveBeenCalledWith('/ast-configs/1/clone', {
        name: 'Clone',
      })
    })

    it('returns mapped config', async () => {
      mockApiPost.mockResolvedValue(serverConfig)
      const result = await cloneAstConfig('login', '1', { configurationName: 'Clone' })
      expect(result.configId).toBe('1')
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
      expect(mockApiPost).toHaveBeenCalledWith('/ast-configs/1/run', data)
      expect(result.runId).toBe('run-1')
    })
  })
})
