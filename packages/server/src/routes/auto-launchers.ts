import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { autoLauncherService } from '../services/auto-launcher.js'

const errorSchema = z.object({ error: z.string() })

export async function autoLauncherRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()

  typed.get(
    '/auto-launchers',
    {
      schema: {
        tags: ['Auto Launchers'],
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              ownerId: z.string(),
              name: z.string(),
              visibility: z.string(),
              steps: z.unknown(),
              createdAt: z.coerce.date(),
              updatedAt: z.coerce.date(),
            }),
          ),
        },
      },
    },
    async (request) => {
      return autoLauncherService.findVisible(request.user.id)
    },
  )

  typed.post(
    '/auto-launchers',
    {
      schema: {
        tags: ['Auto Launchers'],
        body: z.object({
          name: z.string(),
          visibility: z.enum(['private', 'public']).optional(),
          steps: z.array(z.unknown()).optional(),
        }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            visibility: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const launcher = await autoLauncherService.create({
        ...request.body,
        ownerId: request.user.id,
      })
      return reply.status(201).send(launcher)
    },
  )

  typed.patch(
    '/auto-launchers/:id',
    {
      schema: {
        tags: ['Auto Launchers'],
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().optional(),
          visibility: z.enum(['private', 'public']).optional(),
          steps: z.array(z.unknown()).optional(),
        }),
        response: { 200: z.object({ id: z.string(), name: z.string() }), 404: errorSchema },
      },
    },
    async (request, reply) => {
      const launcher = await autoLauncherService.update(
        request.params.id,
        request.user.id,
        request.body,
      )
      if (!launcher) return reply.status(404).send({ error: 'Launcher not found' })
      return launcher
    },
  )

  typed.delete(
    '/auto-launchers/:id',
    {
      schema: {
        tags: ['Auto Launchers'],
        params: z.object({ id: z.string() }),
      },
    },
    async (request, reply) => {
      await autoLauncherService.remove(request.params.id, request.user.id)
      reply.code(204)
      return
    },
  )

  typed.get(
    '/auto-launcher-runs',
    {
      schema: {
        tags: ['Auto Launchers'],
        querystring: z.object({
          limit: z.coerce.number().default(50),
          offset: z.coerce.number().default(0),
        }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              launcherId: z.string(),
              status: z.string(),
              steps: z.unknown(),
              currentStepIndex: z.string(),
              createdAt: z.coerce.date(),
              completedAt: z.coerce.date().nullable(),
            }),
          ),
        },
      },
    },
    async (request) => {
      return autoLauncherService.findRunsByUser(
        request.user.id,
        request.query.limit,
        request.query.offset,
      )
    },
  )
}
