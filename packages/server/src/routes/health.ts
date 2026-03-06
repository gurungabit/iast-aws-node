import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { HealthResponseSchema } from '../schemas/index.js'

export async function healthRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        response: {
          200: HealthResponseSchema,
        },
      },
    },
    async () => {
      return { status: 'ok', timestamp: new Date().toISOString() }
    },
  )
}
