import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { sessionService } from '../services/session.js'
import { generateSessionId } from '../utils.js'

const errorSchema = z.object({ error: z.string() })

export async function sessionRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()

  typed.get(
    '/sessions',
    {
      schema: {
        tags: ['Sessions'],
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              createdAt: z.coerce.date(),
            }),
          ),
        },
      },
    },
    async (request) => {
      return sessionService.findByUser(request.user.id)
    },
  )

  typed.post(
    '/sessions',
    {
      schema: {
        tags: ['Sessions'],
        body: z.object({ name: z.string().optional() }),
        response: {
          201: z.object({
            id: z.string(),
            name: z.string(),
            createdAt: z.coerce.date(),
          }),
        },
      },
    },
    async (request, reply) => {
      const sessionId = generateSessionId()
      const session = await sessionService.create(sessionId, request.user.id, request.body.name)
      return reply.status(201).send(session)
    },
  )

  typed.patch(
    '/sessions/:id',
    {
      schema: {
        tags: ['Sessions'],
        params: z.object({ id: z.string() }),
        body: z.object({ name: z.string() }),
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            createdAt: z.coerce.date(),
          }),
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await sessionService.rename(
        request.params.id,
        request.user.id,
        request.body.name,
      )
      if (!session) return reply.status(404).send({ error: 'Session not found' })
      return session
    },
  )

  typed.delete(
    '/sessions/:id',
    {
      schema: {
        tags: ['Sessions'],
        params: z.object({ id: z.string() }),
      },
    },
    async (request, reply) => {
      await sessionService.remove(request.params.id, request.user.id)
      reply.code(204)
      return
    },
  )
}
