import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../auth/token', () => ({
  getAccessToken: vi.fn().mockResolvedValue('test-token'),
}))

vi.mock('../config', () => ({
  config: { apiUrl: 'http://localhost:3000' },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { apiGet, apiPost, apiPatch, apiDelete } from './api'

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response)
}

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('apiGet', () => {
    it('calls fetch with GET method and auth header', async () => {
      mockFetch.mockReturnValue(jsonResponse({ id: 1 }))

      await apiGet('/sessions')

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/sessions', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      })
    })

    it('returns parsed JSON from response', async () => {
      mockFetch.mockReturnValue(jsonResponse([{ id: '1', name: 'Session 1' }]))

      const result = await apiGet('/sessions')

      expect(result).toEqual([{ id: '1', name: 'Session 1' }])
    })
  })

  describe('apiPost', () => {
    it('calls fetch with POST method and JSON body', async () => {
      mockFetch.mockReturnValue(jsonResponse({ id: '1' }))

      await apiPost('/sessions', { name: 'New Session' })

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/sessions', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Session' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      })
    })

    it('returns parsed JSON from response', async () => {
      const responseData = { id: '1', name: 'New Session' }
      mockFetch.mockReturnValue(jsonResponse(responseData))

      const result = await apiPost('/sessions', { name: 'New Session' })

      expect(result).toEqual(responseData)
    })

    it('returns undefined for 204 No Content response', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          status: 204,
          json: () => Promise.resolve(null),
        } as Response),
      )

      const result = await apiPost('/sessions/1/action')

      expect(result).toBeUndefined()
    })

    it('sends POST without body when body is undefined', async () => {
      mockFetch.mockReturnValue(jsonResponse({ id: '1' }))

      await apiPost('/sessions')

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/sessions', {
        method: 'POST',
        body: undefined,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      })
    })
  })

  describe('apiPatch', () => {
    it('calls fetch with PATCH method and JSON body', async () => {
      mockFetch.mockReturnValue(jsonResponse({ id: '1', name: 'Updated' }))

      await apiPatch('/sessions/1', { name: 'Updated' })

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/sessions/1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      })
    })

    it('returns parsed JSON from response', async () => {
      const responseData = { id: '1', name: 'Updated' }
      mockFetch.mockReturnValue(jsonResponse(responseData))

      const result = await apiPatch('/sessions/1', { name: 'Updated' })

      expect(result).toEqual(responseData)
    })
  })

  describe('apiDelete', () => {
    it('calls fetch with DELETE method', async () => {
      mockFetch.mockReturnValue(jsonResponse(null))

      await apiDelete('/sessions/1')

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/sessions/1', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      })
    })

    it('returns void', async () => {
      mockFetch.mockReturnValue(jsonResponse(null))

      const result = await apiDelete('/sessions/1')

      expect(result).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('throws error with message from JSON error body', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: { message: 'Validation failed' } }),
        } as Response),
      )

      await expect(apiGet('/sessions')).rejects.toThrow('Validation failed')
    })

    it('throws generic HTTP error when body is not JSON', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.reject(new Error('not JSON')),
        } as Response),
      )

      await expect(apiGet('/sessions')).rejects.toThrow('HTTP 500')
    })
  })
})
