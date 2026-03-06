import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockAstConfigService } = vi.hoisted(() => ({
  mockAstConfigService: {
    findVisible: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    clone: vi.fn(),
    findById: vi.fn(),
  },
}))

vi.mock('@src/config.js', () => ({
  config: { entraTenantId: '', entraClientId: '', entraAudience: '' },
}))
vi.mock('@src/auth/entra.js', () => ({ verifyEntraToken: vi.fn() }))
vi.mock('@src/services/user.js', () => ({ userService: { findOrCreate: vi.fn() } }))
vi.mock('@src/services/ast-config.js', () => ({ astConfigService: mockAstConfigService }))

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { astConfigRoutes } from '@src/routes/ast-configs.js'

const testUser = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  entraId: 'oid-1',
}

describe('ast-config routes', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)
    app.addHook('onRequest', async (request) => {
      request.user = testUser
    })
    await app.register(astConfigRoutes)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /ast-configs', () => {
    it('returns configs for the user', async () => {
      const configs = [
        {
          id: 'c1',
          astName: 'ast1',
          ownerId: 'user-1',
          name: 'Config 1',
          visibility: 'private',
          params: {},
          tasks: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]
      mockAstConfigService.findVisible.mockResolvedValueOnce(configs)

      const response = await app.inject({
        method: 'GET',
        url: '/ast-configs',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toHaveLength(1)
      expect(mockAstConfigService.findVisible).toHaveBeenCalledWith('user-1', undefined)
    })

    it('passes astName query parameter', async () => {
      mockAstConfigService.findVisible.mockResolvedValueOnce([])

      await app.inject({
        method: 'GET',
        url: '/ast-configs?astName=specific-ast',
      })

      expect(mockAstConfigService.findVisible).toHaveBeenCalledWith('user-1', 'specific-ast')
    })
  })

  describe('POST /ast-configs', () => {
    it('creates a config and returns 201', async () => {
      const config = { id: 'c1', astName: 'ast1', name: 'New Config', visibility: 'private' }
      mockAstConfigService.create.mockResolvedValueOnce(config)

      const response = await app.inject({
        method: 'POST',
        url: '/ast-configs',
        payload: { astName: 'ast1', name: 'New Config' },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json()).toEqual({
        id: 'c1',
        astName: 'ast1',
        name: 'New Config',
        visibility: 'private',
      })
      expect(mockAstConfigService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          astName: 'ast1',
          name: 'New Config',
          ownerId: 'user-1',
        }),
      )
    })

    it('creates config with optional fields', async () => {
      const config = { id: 'c2', astName: 'ast2', name: 'Public', visibility: 'public' }
      mockAstConfigService.create.mockResolvedValueOnce(config)

      const response = await app.inject({
        method: 'POST',
        url: '/ast-configs',
        payload: {
          astName: 'ast2',
          name: 'Public',
          visibility: 'public',
          params: { key: 'val' },
          tasks: [{ step: 1 }],
        },
      })

      expect(response.statusCode).toBe(201)
    })
  })

  describe('PATCH /ast-configs/:id', () => {
    it('updates config and returns 200', async () => {
      const config = { id: 'c1', astName: 'ast1', name: 'Updated', visibility: 'private' }
      mockAstConfigService.update.mockResolvedValueOnce(config)

      const response = await app.inject({
        method: 'PATCH',
        url: '/ast-configs/c1',
        payload: { name: 'Updated' },
      })

      expect(response.statusCode).toBe(200)
      expect(mockAstConfigService.update).toHaveBeenCalledWith('c1', 'user-1', { name: 'Updated' })
    })

    it('returns 404 when config not found', async () => {
      mockAstConfigService.update.mockResolvedValueOnce(null)

      const response = await app.inject({
        method: 'PATCH',
        url: '/ast-configs/nonexistent',
        payload: { name: 'X' },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({ error: 'Config not found' })
    })
  })

  describe('DELETE /ast-configs/:id', () => {
    it('deletes config and returns 204', async () => {
      mockAstConfigService.remove.mockResolvedValueOnce(true)

      const response = await app.inject({
        method: 'DELETE',
        url: '/ast-configs/c1',
      })

      expect(response.statusCode).toBe(204)
      expect(mockAstConfigService.remove).toHaveBeenCalledWith('c1', 'user-1')
    })

    it('returns 204 even when config not found', async () => {
      mockAstConfigService.remove.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'DELETE',
        url: '/ast-configs/nonexistent',
      })

      expect(response.statusCode).toBe(204)
    })
  })

  describe('POST /ast-configs/:id/clone', () => {
    it('clones config and returns 201', async () => {
      const cloned = { id: 'c2', astName: 'ast1', name: 'Cloned', visibility: 'private' }
      mockAstConfigService.clone.mockResolvedValueOnce(cloned)

      const response = await app.inject({
        method: 'POST',
        url: '/ast-configs/c1/clone',
        payload: { name: 'Cloned' },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json()).toEqual({
        id: 'c2',
        astName: 'ast1',
        name: 'Cloned',
        visibility: 'private',
      })
      expect(mockAstConfigService.clone).toHaveBeenCalledWith('c1', 'user-1', 'Cloned')
    })

    it('returns 404 when original config not found', async () => {
      mockAstConfigService.clone.mockResolvedValueOnce(null)

      const response = await app.inject({
        method: 'POST',
        url: '/ast-configs/nonexistent/clone',
        payload: { name: 'Clone' },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({ error: 'Config not found' })
    })
  })
})
