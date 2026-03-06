import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockCheckDbConnection, mockGetActiveCount, mockGetMaxWorkers } = vi.hoisted(() => ({
  mockCheckDbConnection: vi.fn(),
  mockGetActiveCount: vi.fn(),
  mockGetMaxWorkers: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  checkDbConnection: mockCheckDbConnection,
  db: {},
}))

vi.mock('../terminal/manager.js', () => ({
  terminalManager: {
    getActiveCount: mockGetActiveCount,
    getMaxWorkers: mockGetMaxWorkers,
  },
}))

vi.mock('../config.js', () => ({
  config: {
    entraTenantId: '',
    entraClientId: '',
    entraAudience: '',
  },
}))

vi.mock('../auth/entra.js', () => ({
  verifyEntraToken: vi.fn(),
}))

vi.mock('../services/user.js', () => ({
  userService: {
    findOrCreate: vi.fn(),
  },
}))

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { healthRoutes } from './health.js'

describe('health routes', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)
    await app.register(healthRoutes)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /ping', () => {
    it('returns { pong: true }', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ping',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ pong: true })
    })
  })

  describe('GET /health', () => {
    it('returns status ok when DB connection succeeds', async () => {
      mockCheckDbConnection.mockResolvedValue(true)

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.status).toBe('ok')
      expect(body.db).toBe(true)
      expect(body.timestamp).toBeDefined()
      expect(typeof body.timestamp).toBe('string')
    })

    it('returns status degraded when DB connection fails', async () => {
      mockCheckDbConnection.mockResolvedValue(false)

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.status).toBe('degraded')
      expect(body.db).toBe(false)
    })

    it('returns a valid ISO timestamp', async () => {
      mockCheckDbConnection.mockResolvedValue(true)

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      })

      const body = response.json()
      const parsed = new Date(body.timestamp)
      expect(parsed.toISOString()).toBe(body.timestamp)
    })
  })

  describe('GET /metrics', () => {
    it('returns activeWorkers and maxWorkers', async () => {
      mockGetActiveCount.mockReturnValue(5)
      mockGetMaxWorkers.mockReturnValue(50)

      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({
        activeWorkers: 5,
        maxWorkers: 50,
      })
    })

    it('returns 0 active workers when none are running', async () => {
      mockGetActiveCount.mockReturnValue(0)
      mockGetMaxWorkers.mockReturnValue(50)

      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({
        activeWorkers: 0,
        maxWorkers: 50,
      })
    })

    it('calls terminalManager.getActiveCount and getMaxWorkers', async () => {
      mockGetActiveCount.mockReturnValue(3)
      mockGetMaxWorkers.mockReturnValue(25)

      await app.inject({
        method: 'GET',
        url: '/metrics',
      })

      expect(mockGetActiveCount).toHaveBeenCalledOnce()
      expect(mockGetMaxWorkers).toHaveBeenCalledOnce()
    })
  })
})
