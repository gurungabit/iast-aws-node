import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

export async function authRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()

  typed.get(
    '/auth/me',
    {
      schema: {
        tags: ['Auth'],
        response: {
          200: z.object({
            id: z.string(),
            email: z.string(),
            displayName: z.string(),
          }),
        },
      },
    },
    async (request) => {
      return {
        id: request.user.id,
        email: request.user.email,
        displayName: request.user.displayName,
      }
    },
  )
}
