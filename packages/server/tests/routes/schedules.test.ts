import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockScheduleService } = vi.hoisted(() => ({
  mockScheduleService: {
    findByUser: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    findById: vi.fn(),
    updateStatus: vi.fn(),
  },
}))

vi.mock('@src/config.js', () => ({
  config: { entraTenantId: '', entraClientId: '', entraAudience: '' },
}))
vi.mock('@src/auth/entra.js', () => ({ verifyEntraToken: vi.fn() }))
vi.mock('@src/services/user.js', () => ({ userService: { findOrCreate: vi.fn() } }))
vi.mock('@src/services/schedule.js', () => ({ scheduleService: mockScheduleService }))

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { scheduleRoutes } from '@src/routes/schedules.js'

const testUser = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  entraId: 'oid-1',
}

describe('schedule routes', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = Fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)
    app.addHook('onRequest', async (request) => {
      request.user = testUser
    })
    await app.register(scheduleRoutes)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /schedules', () => {
    it('returns schedules for the user', async () => {
      const schedules = [
        {
          id: 'sch1',
          astName: 'ast1',
          scheduledTime: new Date('2026-06-01T10:00:00Z'),
          status: 'pending',
          createdAt: new Date(),
        },
      ]
      mockScheduleService.findByUser.mockResolvedValueOnce(schedules)

      const response = await app.inject({
        method: 'GET',
        url: '/schedules',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toHaveLength(1)
      expect(mockScheduleService.findByUser).toHaveBeenCalledWith('user-1')
    })

    it('returns empty array when no schedules', async () => {
      mockScheduleService.findByUser.mockResolvedValueOnce([])

      const response = await app.inject({
        method: 'GET',
        url: '/schedules',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual([])
    })
  })

  describe('POST /schedules', () => {
    it('creates a schedule and returns 201', async () => {
      const schedule = {
        id: 'sch1',
        astName: 'ast1',
        scheduledTime: new Date('2026-06-01T10:00:00Z'),
        status: 'pending',
      }
      mockScheduleService.create.mockResolvedValueOnce(schedule)

      const response = await app.inject({
        method: 'POST',
        url: '/schedules',
        payload: {
          astName: 'ast1',
          scheduledTime: '2026-06-01T10:00:00Z',
        },
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().id).toBe('sch1')
      expect(response.json().astName).toBe('ast1')
      expect(mockScheduleService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          astName: 'ast1',
        }),
      )
    })

    it('creates schedule with optional params', async () => {
      const schedule = {
        id: 'sch2',
        astName: 'ast2',
        scheduledTime: new Date('2026-07-01T08:00:00Z'),
        status: 'pending',
      }
      mockScheduleService.create.mockResolvedValueOnce(schedule)

      const response = await app.inject({
        method: 'POST',
        url: '/schedules',
        payload: {
          astName: 'ast2',
          scheduledTime: '2026-07-01T08:00:00Z',
          params: { region: 'us-east-1' },
        },
      })

      expect(response.statusCode).toBe(201)
      expect(mockScheduleService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { region: 'us-east-1' },
        }),
      )
    })

    it('returns the schedule summary in response', async () => {
      const schedule = {
        id: 'sch3',
        astName: 'ast3',
        scheduledTime: new Date('2026-08-01T12:00:00Z'),
        status: 'pending',
      }
      mockScheduleService.create.mockResolvedValueOnce(schedule)

      const response = await app.inject({
        method: 'POST',
        url: '/schedules',
        payload: {
          astName: 'ast3',
          scheduledTime: '2026-08-01T12:00:00Z',
        },
      })

      const body = response.json()
      expect(body).toHaveProperty('id')
      expect(body).toHaveProperty('astName')
      expect(body).toHaveProperty('scheduledTime')
      expect(body).toHaveProperty('status')
    })
  })

  describe('DELETE /schedules/:id', () => {
    it('deletes a schedule and returns 204', async () => {
      mockScheduleService.remove.mockResolvedValueOnce(true)

      const response = await app.inject({
        method: 'DELETE',
        url: '/schedules/sch1',
      })

      expect(response.statusCode).toBe(204)
      expect(mockScheduleService.remove).toHaveBeenCalledWith('sch1', 'user-1')
    })

    it('returns 204 even when schedule not found', async () => {
      mockScheduleService.remove.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'DELETE',
        url: '/schedules/nonexistent',
      })

      expect(response.statusCode).toBe(204)
    })

    it('calls remove with correct userId', async () => {
      mockScheduleService.remove.mockResolvedValueOnce(true)

      await app.inject({
        method: 'DELETE',
        url: '/schedules/sch-abc',
      })

      expect(mockScheduleService.remove).toHaveBeenCalledWith('sch-abc', 'user-1')
    })
  })
})
