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
  getASTConfigs,
  createASTConfig,
  updateASTConfig,
  deleteASTConfig,
  cloneASTConfig,
} from './ast-configs'

describe('ast-configs service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getASTConfigs', () => {
    it('calls apiGet with /ast-configs when no astName provided', async () => {
      mockApiGet.mockResolvedValue([])

      await getASTConfigs()

      expect(mockApiGet).toHaveBeenCalledWith('/ast-configs')
    })

    it('calls apiGet with query string when astName is provided', async () => {
      mockApiGet.mockResolvedValue([])

      await getASTConfigs('LoginAST')

      expect(mockApiGet).toHaveBeenCalledWith('/ast-configs?astName=LoginAST')
    })

    it('returns the list of AST configs', async () => {
      const configs = [{ id: '1', astName: 'LoginAST', name: 'Config 1' }]
      mockApiGet.mockResolvedValue(configs)

      const result = await getASTConfigs()

      expect(result).toEqual(configs)
    })
  })

  describe('createASTConfig', () => {
    it('calls apiPost with /ast-configs and data', async () => {
      const data = { astName: 'LoginAST', name: 'New Config' }
      const created = { id: '1', ...data }
      mockApiPost.mockResolvedValue(created)

      const result = await createASTConfig(data)

      expect(mockApiPost).toHaveBeenCalledWith('/ast-configs', data)
      expect(result).toEqual(created)
    })

    it('includes optional fields when provided', async () => {
      const data = {
        astName: 'LoginAST',
        name: 'Config',
        visibility: 'public',
        params: { timeout: 30 },
        tasks: [{ type: 'login' }],
      }
      mockApiPost.mockResolvedValue({ id: '1', ...data })

      await createASTConfig(data)

      expect(mockApiPost).toHaveBeenCalledWith('/ast-configs', data)
    })
  })

  describe('updateASTConfig', () => {
    it('calls apiPatch with /ast-configs/:id and data', async () => {
      const data = { name: 'Updated Config' }
      mockApiPatch.mockResolvedValue({ id: '1', name: 'Updated Config' })

      const result = await updateASTConfig('1', data)

      expect(mockApiPatch).toHaveBeenCalledWith('/ast-configs/1', data)
      expect(result).toEqual({ id: '1', name: 'Updated Config' })
    })

    it('passes the correct id in the path', async () => {
      mockApiPatch.mockResolvedValue({})

      await updateASTConfig('abc-123', { visibility: 'private' })

      expect(mockApiPatch).toHaveBeenCalledWith('/ast-configs/abc-123', { visibility: 'private' })
    })
  })

  describe('deleteASTConfig', () => {
    it('calls apiDelete with /ast-configs/:id', async () => {
      mockApiDelete.mockResolvedValue(undefined)

      await deleteASTConfig('1')

      expect(mockApiDelete).toHaveBeenCalledWith('/ast-configs/1')
    })

    it('passes the correct id in the path', async () => {
      mockApiDelete.mockResolvedValue(undefined)

      await deleteASTConfig('xyz-789')

      expect(mockApiDelete).toHaveBeenCalledWith('/ast-configs/xyz-789')
    })
  })

  describe('cloneASTConfig', () => {
    it('calls apiPost with /ast-configs/:id/clone and name', async () => {
      const cloned = { id: '2', astName: 'LoginAST', name: 'Cloned Config' }
      mockApiPost.mockResolvedValue(cloned)

      const result = await cloneASTConfig('1', 'Cloned Config')

      expect(mockApiPost).toHaveBeenCalledWith('/ast-configs/1/clone', { name: 'Cloned Config' })
      expect(result).toEqual(cloned)
    })

    it('passes the correct id in the clone path', async () => {
      mockApiPost.mockResolvedValue({})

      await cloneASTConfig('abc-123', 'My Clone')

      expect(mockApiPost).toHaveBeenCalledWith('/ast-configs/abc-123/clone', { name: 'My Clone' })
    })
  })
})
