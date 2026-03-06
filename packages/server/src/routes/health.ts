import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { checkDbConnection } from '../db/index.js'
import { terminalManager } from '../terminal/manager.js'

export async function healthRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()

  typed.get(
    '/ping',
    {
      schema: {
        tags: ['Health'],
        response: { 200: z.object({ pong: z.boolean() }) },
      },
    },
    async () => ({ pong: true }),
  )

  typed.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        response: {
          200: z.object({
            status: z.string(),
            timestamp: z.string(),
            db: z.boolean(),
          }),
        },
      },
    },
    async () => {
      const db = await checkDbConnection()
      return {
        status: db ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        db,
      }
    },
  )

  typed.get(
    '/metrics',
    {
      schema: {
        tags: ['Health'],
        response: {
          200: z.object({
            activeWorkers: z.number(),
            maxWorkers: z.number(),
          }),
        },
      },
    },
    async () => {
      return {
        activeWorkers: terminalManager.getActiveCount(),
        maxWorkers: terminalManager.getMaxWorkers(),
      }
    },
  )
}
