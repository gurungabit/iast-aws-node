import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../config.js', () => ({
  config: { entraTenantId: '', entraClientId: '', entraAudience: '' },
}))

vi.mock('../auth/entra.js', () => ({
  verifyEntraToken: vi.fn(),
}))

vi.mock('../services/user.js', () => ({
  userService: { findOrCreate: vi.fn() },
}))

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { authRoutes } from './auth.js'

const testUser = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  entraId: 'oid-1',
}

describe('auth routes', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    // Auth bypass hook
    app.addHook('onRequest', async (request) => {
      request.user = testUser
    })

    await app.register(authRoutes)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /auth/me', () => {
    it('returns the authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
      })
    })

    it('returns status 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
      })

      expect(response.statusCode).toBe(200)
    })

    it('response contains id, email, and displayName fields', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
      })

      const body = response.json()
      expect(body).toHaveProperty('id')
      expect(body).toHaveProperty('email')
      expect(body).toHaveProperty('displayName')
    })

    it('does not expose entraId in the response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
      })

      const body = response.json()
      expect(body.entraId).toBeUndefined()
    })

    it('returns user details from request.user', async () => {
      // Override user for this specific test
      const customApp = Fastify()
      customApp.setValidatorCompiler(validatorCompiler)
      customApp.setSerializerCompiler(serializerCompiler)
      customApp.addHook('onRequest', async (request) => {
        request.user = {
          id: 'custom-id',
          email: 'custom@test.com',
          displayName: 'Custom User',
          entraId: 'custom-oid',
        }
      })
      await customApp.register(authRoutes)
      await customApp.ready()

      const response = await customApp.inject({
        method: 'GET',
        url: '/auth/me',
      })

      expect(response.json()).toEqual({
        id: 'custom-id',
        email: 'custom@test.com',
        displayName: 'Custom User',
      })

      await customApp.close()
    })

    it('returns JSON content type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
      })

      expect(response.headers['content-type']).toContain('application/json')
    })

    it('responds with correct shape for different users', async () => {
      const altApp = Fastify()
      altApp.setValidatorCompiler(validatorCompiler)
      altApp.setSerializerCompiler(serializerCompiler)
      altApp.addHook('onRequest', async (request) => {
        request.user = {
          id: 'alt-id',
          email: 'alt@domain.com',
          displayName: 'Alt Name',
          entraId: 'alt-oid',
        }
      })
      await altApp.register(authRoutes)
      await altApp.ready()

      const response = await altApp.inject({
        method: 'GET',
        url: '/auth/me',
      })

      const body = response.json()
      expect(body.id).toBe('alt-id')
      expect(body.email).toBe('alt@domain.com')
      expect(body.displayName).toBe('Alt Name')

      await altApp.close()
    })

    it('returns 404 for unknown routes under /auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/unknown',
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
