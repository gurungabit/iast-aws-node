import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockExecutionService } = vi.hoisted(() => ({
  mockExecutionService: {
    findByUser: vi.fn(),
    getPolicies: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    findById: vi.fn(),
    batchInsertPolicies: vi.fn(),
    getCompletedPolicies: vi.fn(),
  },
}))

vi.mock('@src/config.js', () => ({
  config: { entraTenantId: '', entraClientId: '', entraAudience: '' },
}))
vi.mock('@src/auth/entra.js', () => ({ verifyEntraToken: vi.fn() }))
vi.mock('@src/services/user.js', () => ({ userService: { findOrCreate: vi.fn() } }))
vi.mock('@src/services/execution.js', () => ({ executionService: mockExecutionService }))

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { historyRoutes } from '@src/routes/history.js'

const testUser = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  entraId: 'oid-1',
}

describe('history routes', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)
    app.addHook('onRequest', async (request) => {
      request.user = testUser
    })
    await app.register(historyRoutes)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /history', () => {
    it('returns executions for the user with default params', async () => {
      const executions = [
        {
          id: 'e1',
          sessionId: 's1',
          astName: 'ast1',
          configName: null,
          status: 'completed',
          hostUser: null,
          runId: null,
          launcherName: null,
          executionDate: '2026-01-01',
          startedAt: new Date('2026-01-01T10:00:00Z'),
          completedAt: new Date('2026-01-01T10:05:00Z'),
          totalPolicies: 10,
          successCount: 8,
          failureCount: 1,
          errorCount: 1,
          resumedFromId: null,
        },
      ]
      mockExecutionService.findByUser.mockResolvedValueOnce(executions)

      const response = await app.inject({
        method: 'GET',
        url: '/history',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toHaveLength(1)
      expect(mockExecutionService.findByUser).toHaveBeenCalledWith('user-1', undefined, 50, 0)
    })

    it('passes date query parameter', async () => {
      mockExecutionService.findByUser.mockResolvedValueOnce([])

      const response = await app.inject({
        method: 'GET',
        url: '/history?date=2026-01-15',
      })

      expect(response.statusCode).toBe(200)
      expect(mockExecutionService.findByUser).toHaveBeenCalledWith('user-1', '2026-01-15', 50, 0)
    })

    it('passes custom limit and offset', async () => {
      mockExecutionService.findByUser.mockResolvedValueOnce([])

      const response = await app.inject({
        method: 'GET',
        url: '/history?limit=10&offset=20',
      })

      expect(response.statusCode).toBe(200)
      expect(mockExecutionService.findByUser).toHaveBeenCalledWith('user-1', undefined, 10, 20)
    })

    it('returns empty array when no executions', async () => {
      mockExecutionService.findByUser.mockResolvedValueOnce([])

      const response = await app.inject({
        method: 'GET',
        url: '/history',
      })

      expect(response.json()).toEqual([])
    })
  })

  describe('GET /history/:id/policies', () => {
    it('returns policies for an execution', async () => {
      const policies = [
        {
          id: 'p1',
          policyNumber: 'POL001',
          status: 'success',
          durationMs: 150,
          error: null,
          data: null,
        },
      ]
      mockExecutionService.getPolicies.mockResolvedValueOnce(policies)

      const response = await app.inject({
        method: 'GET',
        url: '/history/e1/policies',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toHaveLength(1)
      expect(mockExecutionService.getPolicies).toHaveBeenCalledWith('e1', undefined, 100, 0)
    })

    it('passes status filter query parameter', async () => {
      mockExecutionService.getPolicies.mockResolvedValueOnce([])

      const response = await app.inject({
        method: 'GET',
        url: '/history/e1/policies?status=failure',
      })

      expect(response.statusCode).toBe(200)
      expect(mockExecutionService.getPolicies).toHaveBeenCalledWith('e1', 'failure', 100, 0)
    })

    it('passes custom limit and offset', async () => {
      mockExecutionService.getPolicies.mockResolvedValueOnce([])

      await app.inject({
        method: 'GET',
        url: '/history/e1/policies?limit=25&offset=10',
      })

      expect(mockExecutionService.getPolicies).toHaveBeenCalledWith('e1', undefined, 25, 10)
    })

    it('returns empty array when no policies', async () => {
      mockExecutionService.getPolicies.mockResolvedValueOnce([])

      const response = await app.inject({
        method: 'GET',
        url: '/history/e1/policies',
      })

      expect(response.json()).toEqual([])
    })

    it('passes all query params together', async () => {
      mockExecutionService.getPolicies.mockResolvedValueOnce([])

      await app.inject({
        method: 'GET',
        url: '/history/exec-123/policies?status=error&limit=5&offset=3',
      })

      expect(mockExecutionService.getPolicies).toHaveBeenCalledWith('exec-123', 'error', 5, 3)
    })
  })

  describe('GET /history/:id/resume-info', () => {
    it('returns resume info for a failed execution', async () => {
      mockExecutionService.findById.mockResolvedValueOnce({
        id: 'e1',
        astName: 'login',
        status: 'failed',
        params: { username: 'user', policyNumbers: ['POL1'] },
        successCount: 5,
        totalPolicies: 10,
      })

      const response = await app.inject({
        method: 'GET',
        url: '/history/e1/resume-info',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.canResume).toBe(true)
      expect(body.astName).toBe('login')
      expect(body.params).toEqual({ username: 'user', policyNumbers: ['POL1'] })
      expect(body.completedCount).toBe(5)
      expect(body.totalPolicies).toBe(10)
      expect(body.status).toBe('failed')
    })

    it('returns canResume=true for cancelled status', async () => {
      mockExecutionService.findById.mockResolvedValueOnce({
        id: 'e2',
        astName: 'bi-renew',
        status: 'cancelled',
        params: null,
        successCount: 3,
        totalPolicies: 8,
      })

      const response = await app.inject({
        method: 'GET',
        url: '/history/e2/resume-info',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().canResume).toBe(true)
    })

    it('returns canResume=true for paused status', async () => {
      mockExecutionService.findById.mockResolvedValueOnce({
        id: 'e3',
        astName: 'rout-extractor',
        status: 'paused',
        params: { sourceMode: 'rout' },
        successCount: 1,
        totalPolicies: 6,
      })

      const response = await app.inject({
        method: 'GET',
        url: '/history/e3/resume-info',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().canResume).toBe(true)
    })

    it('returns canResume=false for completed status', async () => {
      mockExecutionService.findById.mockResolvedValueOnce({
        id: 'e4',
        astName: 'login',
        status: 'completed',
        params: null,
        successCount: 10,
        totalPolicies: 10,
      })

      const response = await app.inject({
        method: 'GET',
        url: '/history/e4/resume-info',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().canResume).toBe(false)
    })

    it('returns 404 when execution not found', async () => {
      mockExecutionService.findById.mockResolvedValueOnce(null)

      const response = await app.inject({
        method: 'GET',
        url: '/history/nonexistent/resume-info',
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({ error: 'Execution not found' })
    })

    it('returns null params when execution has no params', async () => {
      mockExecutionService.findById.mockResolvedValueOnce({
        id: 'e5',
        astName: 'login',
        status: 'failed',
        params: undefined,
        successCount: 0,
        totalPolicies: 5,
      })

      const response = await app.inject({
        method: 'GET',
        url: '/history/e5/resume-info',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().params).toBeNull()
    })

    it('returns canResume=true for running status', async () => {
      mockExecutionService.findById.mockResolvedValueOnce({
        id: 'e6',
        astName: 'bi-renew',
        status: 'running',
        params: null,
        successCount: 2,
        totalPolicies: 5,
      })

      const response = await app.inject({
        method: 'GET',
        url: '/history/e6/resume-info',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().canResume).toBe(true)
    })

    it('returns canResume=false for pending status', async () => {
      mockExecutionService.findById.mockResolvedValueOnce({
        id: 'e7',
        astName: 'login',
        status: 'pending',
        params: null,
        successCount: 0,
        totalPolicies: 0,
      })

      const response = await app.inject({
        method: 'GET',
        url: '/history/e7/resume-info',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().canResume).toBe(false)
    })
  })
})
