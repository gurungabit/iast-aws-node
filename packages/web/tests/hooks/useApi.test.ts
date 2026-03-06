import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockUseQuery, mockUseMutation, mockUseQueryClient, mockApiGet, mockApiPost, mockApiPatch, mockApiDelete, mockInvalidateQueries } =
  vi.hoisted(() => ({
    mockUseQuery: vi.fn(),
    mockUseMutation: vi.fn(),
    mockUseQueryClient: vi.fn(),
    mockApiGet: vi.fn(),
    mockApiPost: vi.fn(),
    mockApiPatch: vi.fn(),
    mockApiDelete: vi.fn(),
    mockInvalidateQueries: vi.fn(),
  }))

vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useQueryClient: mockUseQueryClient,
}))

vi.mock('@src/services/api', () => ({
  apiGet: mockApiGet,
  apiPost: mockApiPost,
  apiPatch: mockApiPatch,
  apiDelete: mockApiDelete,
}))

import { useApiQuery, useApiMutation } from '@src/hooks/useApi'

describe('useApi hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseQuery.mockReturnValue({ data: null, isLoading: false })
    mockUseMutation.mockReturnValue({ mutate: vi.fn() })
    mockUseQueryClient.mockReturnValue({ invalidateQueries: mockInvalidateQueries })
  })

  describe('useApiQuery', () => {
    it('passes correct queryKey to useQuery', () => {
      useApiQuery(['sessions'], '/sessions')

      expect(mockUseQuery).toHaveBeenCalledTimes(1)
      const options = mockUseQuery.mock.calls[0][0]
      expect(options.queryKey).toEqual(['sessions'])
    })

    it('passes a queryFn that calls apiGet with the path', async () => {
      mockApiGet.mockResolvedValue([{ id: '1' }])

      useApiQuery(['sessions'], '/sessions')

      const options = mockUseQuery.mock.calls[0][0]
      const result = await options.queryFn()

      expect(mockApiGet).toHaveBeenCalledWith('/sessions')
      expect(result).toEqual([{ id: '1' }])
    })

    it('passes enabled option defaulting to true', () => {
      useApiQuery(['sessions'], '/sessions')

      const options = mockUseQuery.mock.calls[0][0]
      expect(options.enabled).toBe(true)
    })

    it('passes enabled option when explicitly set to false', () => {
      useApiQuery(['sessions'], '/sessions', false)

      const options = mockUseQuery.mock.calls[0][0]
      expect(options.enabled).toBe(false)
    })

    it('returns the result from useQuery', () => {
      const mockResult = { data: [{ id: '1' }], isLoading: false, error: null }
      mockUseQuery.mockReturnValue(mockResult)

      const result = useApiQuery(['sessions'], '/sessions')

      expect(result).toBe(mockResult)
    })
  })

  describe('useApiMutation', () => {
    it('creates a mutation with post method that calls apiPost', async () => {
      useApiMutation('post', '/sessions')

      const options = mockUseMutation.mock.calls[0][0]
      mockApiPost.mockResolvedValue({ id: '1' })

      const result = await options.mutationFn({ name: 'Test' })

      expect(mockApiPost).toHaveBeenCalledWith('/sessions', { name: 'Test' })
      expect(result).toEqual({ id: '1' })
    })

    it('creates a mutation with patch method that calls apiPatch', async () => {
      useApiMutation('patch', '/sessions/1')

      const options = mockUseMutation.mock.calls[0][0]
      mockApiPatch.mockResolvedValue({ id: '1', name: 'Updated' })

      const result = await options.mutationFn({ name: 'Updated' })

      expect(mockApiPatch).toHaveBeenCalledWith('/sessions/1', { name: 'Updated' })
      expect(result).toEqual({ id: '1', name: 'Updated' })
    })

    it('creates a mutation with delete method that calls apiDelete', async () => {
      useApiMutation('delete', '/sessions/1')

      const options = mockUseMutation.mock.calls[0][0]
      mockApiDelete.mockResolvedValue(undefined)

      const result = await options.mutationFn(undefined)

      expect(mockApiDelete).toHaveBeenCalledWith('/sessions/1')
      expect(result).toBeUndefined()
    })

    it('supports dynamic path as a function', async () => {
      useApiMutation<unknown, { id: string }>('delete', (body) => `/sessions/${body.id}`)

      const options = mockUseMutation.mock.calls[0][0]
      mockApiDelete.mockResolvedValue(undefined)

      await options.mutationFn({ id: 'abc-123' })

      expect(mockApiDelete).toHaveBeenCalledWith('/sessions/abc-123')
    })

    it('invalidates query keys on success', () => {
      useApiMutation('post', '/sessions', [['sessions'], ['session-count']])

      const options = mockUseMutation.mock.calls[0][0]

      // Simulate onSuccess callback
      options.onSuccess()

      expect(mockInvalidateQueries).toHaveBeenCalledTimes(2)
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['sessions'] })
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['session-count'] })
    })

    it('does not invalidate when no invalidateKeys provided', () => {
      useApiMutation('post', '/sessions')

      const options = mockUseMutation.mock.calls[0][0]
      options.onSuccess()

      expect(mockInvalidateQueries).not.toHaveBeenCalled()
    })
  })
})
