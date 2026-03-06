import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockSessionService, mockGenerateSessionId } = vi.hoisted(() => ({
  mockSessionService: {
    create: vi.fn(),
    findByUser: vi.fn(),
    findById: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
  },
  mockGenerateSessionId: vi.fn(),
}))

vi.mock('../config.js', () => ({
  config: { entraTenantId: '', entraClientId: '', entraAudience: '' },
}))
vi.mock('../auth/entra.js', () => ({ verifyEntraToken: vi.fn() }))
vi.mock('../services/user.js', () => ({ userService: { findOrCreate: vi.fn() } }))
vi.mock('../services/session.js', () => ({ sessionService: mockSessionService }))
vi.mock('../utils.js', () => ({ generateSessionId: mockGenerateSessionId }))

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { sessionRoutes } from './sessions.js'

const testUser = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  entraId: 'oid-1',
}

describe('session routes', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)
    app.addHook('onRequest', async (request) => {
      request.user = testUser
    })
    await app.register(sessionRoutes)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /sessions', () => {
    it('returns sessions for the authenticated user', async () => {
      const sessions = [
        { id: 's1', name: 'Session 1', createdAt: new Date('2026-01-01T00:00:00Z') },
        { id: 's2', name: 'Session 2', createdAt: new Date('2026-01-02T00:00:00Z') },
      ]
      mockSessionService.findByUser.mockResolvedValueOnce(sessions)

      const response = await app.inject({
        method: 'GET',
        url: '/sessions',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toHaveLength(2)
      expect(mockSessionService.findByUser).toHaveBeenCalledWith('user-1')
    })

    it('returns empty array when no sessions exist', async () => {
      mockSessionService.findByUser.mockResolvedValueOnce([])

      const response = await app.inject({
        method: 'GET',
        url: '/sessions',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual([])
    })
  })

  describe('POST /sessions', () => {
    it('creates a new session and returns 201', async () => {
      mockGenerateSessionId.mockReturnValueOnce('ses_abc12345')
      const session = { id: 'ses_abc12345', name: 'New', createdAt: new Date('2026-01-01T00:00:00Z') }
      mockSessionService.create.mockResolvedValueOnce(session)

      const response = await app.inject({
        method: 'POST',
        url: '/sessions',
        payload: { name: 'New' },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().id).toBe('ses_abc12345')
      expect(mockSessionService.create).toHaveBeenCalledWith('ses_abc12345', 'user-1', 'New')
    })

    it('creates session without name', async () => {
      mockGenerateSessionId.mockReturnValueOnce('ses_xyz')
      const session = { id: 'ses_xyz', name: '', createdAt: new Date() }
      mockSessionService.create.mockResolvedValueOnce(session)

      const response = await app.inject({
        method: 'POST',
        url: '/sessions',
        payload: {},
      })

      expect(response.statusCode).toBe(201)
      expect(mockSessionService.create).toHaveBeenCalledWith('ses_xyz', 'user-1', undefined)
    })
  })

  describe('PATCH /sessions/:id', () => {
    it('renames a session and returns 200', async () => {
      const session = { id: 's1', name: 'Renamed', createdAt: new Date('2026-01-01T00:00:00Z') }
      mockSessionService.rename.mockResolvedValueOnce(session)

      const response = await app.inject({
        method: 'PATCH',
        url: '/sessions/s1',
        payload: { name: 'Renamed' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().name).toBe('Renamed')
      expect(mockSessionService.rename).toHaveBeenCalledWith('s1', 'user-1', 'Renamed')
    })

    it('returns 404 when session not found', async () => {
      mockSessionService.rename.mockResolvedValueOnce(null)

      const response = await app.inject({
        method: 'PATCH',
        url: '/sessions/nonexistent',
        payload: { name: 'Whatever' },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({ error: 'Session not found' })
    })
  })

  describe('DELETE /sessions/:id', () => {
    it('deletes a session and returns 204', async () => {
      mockSessionService.remove.mockResolvedValueOnce(true)

      const response = await app.inject({
        method: 'DELETE',
        url: '/sessions/s1',
      })

      expect(response.statusCode).toBe(204)
      expect(mockSessionService.remove).toHaveBeenCalledWith('s1', 'user-1')
    })

    it('returns 204 even when session not found (idempotent delete)', async () => {
      mockSessionService.remove.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'DELETE',
        url: '/sessions/nonexistent',
      })

      expect(response.statusCode).toBe(204)
    })
  })
})
