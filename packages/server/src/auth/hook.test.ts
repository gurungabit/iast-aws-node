import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockVerifyEntraToken, mockFindOrCreate } = vi.hoisted(() => ({
  mockVerifyEntraToken: vi.fn(),
  mockFindOrCreate: vi.fn(),
}))

vi.mock('./entra.js', () => ({
  verifyEntraToken: mockVerifyEntraToken,
}))

vi.mock('../services/user.js', () => ({
  userService: {
    findOrCreate: mockFindOrCreate,
  },
}))

import { authHook, type AuthUser } from './hook.js'

interface MockRequest {
  url: string
  headers: Record<string, string | undefined>
  user: AuthUser | undefined
}

interface MockReply {
  status: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
}

function createMockRequest(overrides: Partial<{ url: string; headers: Record<string, string | undefined> }> = {}): MockRequest {
  return {
    url: overrides.url ?? '/api/data',
    headers: overrides.headers ?? {},
    user: undefined,
  }
}

function createMockReply(): MockReply {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  }
}

/** Wrapper to call authHook with mock objects that partially satisfy FastifyRequest/FastifyReply */
// @ts-expect-error - mock objects intentionally omit unrelated FastifyRequest/FastifyReply properties
const callAuthHook: (request: MockRequest, reply: MockReply) => Promise<void> = authHook

describe('authHook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('skipped routes', () => {
    it('skips /health route', async () => {
      const request = createMockRequest({ url: '/health' })
      const reply = createMockReply()

      await callAuthHook(request, reply)

      expect(reply.status).not.toHaveBeenCalled()
      expect(mockVerifyEntraToken).not.toHaveBeenCalled()
    })

    it('skips /ping route', async () => {
      const request = createMockRequest({ url: '/ping' })
      const reply = createMockReply()

      await callAuthHook(request, reply)

      expect(reply.status).not.toHaveBeenCalled()
      expect(mockVerifyEntraToken).not.toHaveBeenCalled()
    })

    it('skips /metrics route', async () => {
      const request = createMockRequest({ url: '/metrics' })
      const reply = createMockReply()

      await callAuthHook(request, reply)

      expect(reply.status).not.toHaveBeenCalled()
      expect(mockVerifyEntraToken).not.toHaveBeenCalled()
    })

    it('skips routes starting with /docs', async () => {
      const request = createMockRequest({ url: '/docs/json' })
      const reply = createMockReply()

      await callAuthHook(request, reply)

      expect(reply.status).not.toHaveBeenCalled()
      expect(mockVerifyEntraToken).not.toHaveBeenCalled()
    })

    it('skips /docs exactly', async () => {
      const request = createMockRequest({ url: '/docs' })
      const reply = createMockReply()

      await callAuthHook(request, reply)

      expect(reply.status).not.toHaveBeenCalled()
    })
  })

  describe('missing token', () => {
    it('returns 401 when no authorization header is present', async () => {
      const request = createMockRequest({ url: '/api/data', headers: {} })
      const reply = createMockReply()

      await callAuthHook(request, reply)

      expect(reply.status).toHaveBeenCalledWith(401)
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing token' },
      })
    })

    it('returns 401 when authorization header does not start with Bearer', async () => {
      const request = createMockRequest({
        url: '/api/data',
        headers: { authorization: 'Basic abc123' },
      })
      const reply = createMockReply()

      await callAuthHook(request, reply)

      expect(reply.status).toHaveBeenCalledWith(401)
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing token' },
      })
    })

    it('returns 401 when authorization header is just "Bearer" with no token', async () => {
      const request = createMockRequest({
        url: '/api/data',
        headers: { authorization: 'Bearer' },
      })
      const reply = createMockReply()

      await callAuthHook(request, reply)

      expect(reply.status).toHaveBeenCalledWith(401)
    })
  })

  describe('valid token', () => {
    it('sets request.user from verified token and user service', async () => {
      mockVerifyEntraToken.mockResolvedValue({
        sub: 'sub-123',
        email: 'user@example.com',
        name: 'Test User',
        oid: 'oid-456',
      })

      mockFindOrCreate.mockResolvedValue({
        id: 'user-id-789',
        email: 'user@example.com',
        displayName: 'Test User',
        entraId: 'oid-456',
      })

      const request = createMockRequest({
        url: '/api/data',
        headers: { authorization: 'Bearer valid-jwt-token' },
      })
      const reply = createMockReply()

      await callAuthHook(request, reply)

      expect(mockVerifyEntraToken).toHaveBeenCalledWith('valid-jwt-token')
      expect(mockFindOrCreate).toHaveBeenCalledWith({
        sub: 'sub-123',
        email: 'user@example.com',
        name: 'Test User',
        oid: 'oid-456',
      })
      expect(request.user).toEqual({
        id: 'user-id-789',
        email: 'user@example.com',
        displayName: 'Test User',
        entraId: 'oid-456',
      })
      expect(reply.status).not.toHaveBeenCalled()
    })
  })

  describe('invalid token', () => {
    it('returns 401 when verifyEntraToken throws', async () => {
      mockVerifyEntraToken.mockRejectedValue(new Error('Token verification failed'))

      const request = createMockRequest({
        url: '/api/data',
        headers: { authorization: 'Bearer bad-token' },
      })
      const reply = createMockReply()

      await callAuthHook(request, reply)

      expect(reply.status).toHaveBeenCalledWith(401)
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
      })
    })

    it('returns 401 when userService.findOrCreate throws', async () => {
      mockVerifyEntraToken.mockResolvedValue({
        sub: 'sub-123',
        email: 'user@example.com',
        name: 'Test User',
        oid: 'oid-456',
      })
      mockFindOrCreate.mockRejectedValue(new Error('DB error'))

      const request = createMockRequest({
        url: '/api/data',
        headers: { authorization: 'Bearer valid-token' },
      })
      const reply = createMockReply()

      await callAuthHook(request, reply)

      expect(reply.status).toHaveBeenCalledWith(401)
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
      })
    })
  })
})
