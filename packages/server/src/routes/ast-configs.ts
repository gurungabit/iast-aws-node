import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { astConfigService } from '../services/ast-config.js'

const errorSchema = z.object({ error: z.string() })
const configSummary = z.object({
  id: z.string(),
  astName: z.string(),
  name: z.string(),
  visibility: z.string(),
})

export async function astConfigRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()

  typed.get(
    '/ast-configs',
    {
      schema: {
        tags: ['AST Configs'],
        querystring: z.object({ astName: z.string().optional() }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              astName: z.string(),
              ownerId: z.string(),
              name: z.string(),
              visibility: z.string(),
              params: z.unknown(),
              tasks: z.unknown(),
              createdAt: z.coerce.date(),
              updatedAt: z.coerce.date(),
            }),
          ),
        },
      },
    },
    async (request) => {
      return astConfigService.findVisible(request.user.id, request.query.astName)
    },
  )

  typed.post(
    '/ast-configs',
    {
      schema: {
        tags: ['AST Configs'],
        body: z.object({
          astName: z.string(),
          name: z.string(),
          visibility: z.enum(['private', 'public']).optional(),
          params: z.record(z.string(), z.unknown()).optional(),
          tasks: z.array(z.unknown()).optional(),
        }),
        response: { 201: configSummary },
      },
    },
    async (request, reply) => {
      const config = await astConfigService.create({
        ...request.body,
        ownerId: request.user.id,
      })
      reply.status(201)
      return {
        id: config.id,
        astName: config.astName,
        name: config.name,
        visibility: config.visibility,
      }
    },
  )

  typed.patch(
    '/ast-configs/:id',
    {
      schema: {
        tags: ['AST Configs'],
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().optional(),
          visibility: z.enum(['private', 'public']).optional(),
          params: z.record(z.string(), z.unknown()).optional(),
          tasks: z.array(z.unknown()).optional(),
        }),
        response: { 200: configSummary, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const config = await astConfigService.update(request.params.id, request.user.id, request.body)
      if (!config) return reply.status(404).send({ error: 'Config not found' })
      return config
    },
  )

  typed.delete(
    '/ast-configs/:id',
    {
      schema: {
        tags: ['AST Configs'],
        params: z.object({ id: z.string() }),
      },
    },
    async (request, reply) => {
      await astConfigService.remove(request.params.id, request.user.id)
      reply.code(204)
      return
    },
  )

  typed.post(
    '/ast-configs/:id/clone',
    {
      schema: {
        tags: ['AST Configs'],
        params: z.object({ id: z.string() }),
        body: z.object({ name: z.string() }),
        response: { 201: configSummary, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const config = await astConfigService.clone(
        request.params.id,
        request.user.id,
        request.body.name,
      )
      if (!config) return reply.status(404).send({ error: 'Config not found' })
      reply.status(201)
      return {
        id: config.id,
        astName: config.astName,
        name: config.name,
        visibility: config.visibility,
      }
    },
  )
}
