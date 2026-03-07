import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { scheduleService } from '../services/schedule.js'

export async function scheduleRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()

  typed.get(
    '/schedules',
    {
      schema: {
        tags: ['Schedules'],
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              astName: z.string(),
              scheduledTime: z.coerce.date(),
              status: z.string(),
              createdAt: z.coerce.date(),
            }),
          ),
        },
      },
    },
    async (request) => {
      return scheduleService.findByUser(request.user.id)
    },
  )

  typed.post(
    '/schedules',
    {
      schema: {
        tags: ['Schedules'],
        body: z.object({
          astName: z.string(),
          scheduledTime: z.coerce.date(),
          params: z.record(z.string(), z.unknown()).optional(),
          credentials: z
            .object({
              userId: z.string(),
              password: z.string(),
            })
            .optional(),
        }),
        response: {
          201: z.object({
            id: z.string(),
            astName: z.string(),
            scheduledTime: z.coerce.date(),
            status: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const schedule = await scheduleService.create({
        userId: request.user.id,
        astName: request.body.astName,
        scheduledTime: request.body.scheduledTime,
        params: request.body.params,
      })
      reply.status(201)
      return {
        id: schedule.id,
        astName: schedule.astName,
        scheduledTime: schedule.scheduledTime,
        status: schedule.status,
      }
    },
  )

  typed.delete(
    '/schedules/:id',
    {
      schema: {
        tags: ['Schedules'],
        params: z.object({ id: z.string() }),
      },
    },
    async (request, reply) => {
      await scheduleService.remove(request.params.id, request.user.id)
      return reply.status(204).send()
    },
  )
}
