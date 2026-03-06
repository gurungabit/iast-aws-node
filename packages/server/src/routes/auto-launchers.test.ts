import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockAutoLauncherService } = vi.hoisted(() => ({
  mockAutoLauncherService: {
    findVisible: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    findById: vi.fn(),
    createRun: vi.fn(),
    updateRun: vi.fn(),
    findRunsByUser: vi.fn(),
    executeRun: vi.fn(),
  },
}))

vi.mock('../config.js', () => ({
  config: { entraTenantId: '', entraClientId: '', entraAudience: '' },
}))
vi.mock('../auth/entra.js', () => ({ verifyEntraToken: vi.fn() }))
vi.mock('../services/user.js', () => ({ userService: { findOrCreate: vi.fn() } }))
vi.mock('../services/auto-launcher.js', () => ({ autoLauncherService: mockAutoLauncherService }))

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { autoLauncherRoutes } from './auto-launchers.js'

const testUser = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  entraId: 'oid-1',
}

describe('auto-launcher routes', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)
    app.addHook('onRequest', async (request) => {
      request.user = testUser
    })
    await app.register(autoLauncherRoutes)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /auto-launchers', () => {
    it('returns launchers for the user', async () => {
      const launchers = [
        {
          id: 'al1',
          ownerId: 'user-1',
          name: 'Launcher 1',
          visibility: 'private',
          steps: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]
      mockAutoLauncherService.findVisible.mockResolvedValueOnce(launchers)

      const response = await app.inject({
        method: 'GET',
        url: '/auto-launchers',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toHaveLength(1)
      expect(mockAutoLauncherService.findVisible).toHaveBeenCalledWith('user-1')
    })

    it('returns empty array when no launchers exist', async () => {
      mockAutoLauncherService.findVisible.mockResolvedValueOnce([])

      const response = await app.inject({
        method: 'GET',
        url: '/auto-launchers',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual([])
    })
  })

  describe('POST /auto-launchers', () => {
    it('creates a launcher and returns 201', async () => {
      const launcher = { id: 'al1', name: 'New Launcher', visibility: 'private' }
      mockAutoLauncherService.create.mockResolvedValueOnce(launcher)

      const response = await app.inject({
        method: 'POST',
        url: '/auto-launchers',
        payload: { name: 'New Launcher' },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().name).toBe('New Launcher')
      expect(mockAutoLauncherService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Launcher',
          ownerId: 'user-1',
        }),
      )
    })

    it('passes optional visibility and steps', async () => {
      const launcher = { id: 'al2', name: 'Public', visibility: 'public' }
      mockAutoLauncherService.create.mockResolvedValueOnce(launcher)

      const response = await app.inject({
        method: 'POST',
        url: '/auto-launchers',
        payload: {
          name: 'Public',
          visibility: 'public',
          steps: [{ astName: 'ast1' }],
        },
      })

      expect(response.statusCode).toBe(201)
    })
  })

  describe('PATCH /auto-launchers/:id', () => {
    it('updates launcher and returns 200', async () => {
      const launcher = { id: 'al1', name: 'Updated' }
      mockAutoLauncherService.update.mockResolvedValueOnce(launcher)

      const response = await app.inject({
        method: 'PATCH',
        url: '/auto-launchers/al1',
        payload: { name: 'Updated' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().name).toBe('Updated')
      expect(mockAutoLauncherService.update).toHaveBeenCalledWith('al1', 'user-1', { name: 'Updated' })
    })

    it('returns 404 when launcher not found', async () => {
      mockAutoLauncherService.update.mockResolvedValueOnce(null)

      const response = await app.inject({
        method: 'PATCH',
        url: '/auto-launchers/missing',
        payload: { name: 'X' },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({ error: 'Launcher not found' })
    })
  })

  describe('DELETE /auto-launchers/:id', () => {
    it('deletes launcher and returns 204', async () => {
      mockAutoLauncherService.remove.mockResolvedValueOnce(true)

      const response = await app.inject({
        method: 'DELETE',
        url: '/auto-launchers/al1',
      })

      expect(response.statusCode).toBe(204)
      expect(mockAutoLauncherService.remove).toHaveBeenCalledWith('al1', 'user-1')
    })

    it('returns 204 even when launcher not found', async () => {
      mockAutoLauncherService.remove.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'DELETE',
        url: '/auto-launchers/nonexistent',
      })

      expect(response.statusCode).toBe(204)
    })
  })

  describe('GET /auto-launcher-runs', () => {
    it('returns runs for the user with defaults', async () => {
      const runs = [
        {
          id: 'run1',
          launcherId: 'al1',
          status: 'completed',
          steps: [],
          currentStepIndex: '0',
          createdAt: new Date(),
          completedAt: new Date(),
        },
      ]
      mockAutoLauncherService.findRunsByUser.mockResolvedValueOnce(runs)

      const response = await app.inject({
        method: 'GET',
        url: '/auto-launcher-runs',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toHaveLength(1)
      expect(mockAutoLauncherService.findRunsByUser).toHaveBeenCalledWith('user-1', 50, 0)
    })

    it('passes custom limit and offset', async () => {
      mockAutoLauncherService.findRunsByUser.mockResolvedValueOnce([])

      await app.inject({
        method: 'GET',
        url: '/auto-launcher-runs?limit=10&offset=5',
      })

      expect(mockAutoLauncherService.findRunsByUser).toHaveBeenCalledWith('user-1', 10, 5)
    })

    it('returns empty array when no runs exist', async () => {
      mockAutoLauncherService.findRunsByUser.mockResolvedValueOnce([])

      const response = await app.inject({
        method: 'GET',
        url: '/auto-launcher-runs',
      })

      expect(response.json()).toEqual([])
    })
  })
})
