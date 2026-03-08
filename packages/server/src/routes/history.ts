import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { executionService } from '../services/execution.js'

export async function historyRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()

  typed.get(
    '/history',
    {
      schema: {
        tags: ['History'],
        querystring: z.object({
          date: z.string().optional(),
          limit: z.coerce.number().default(50),
          offset: z.coerce.number().default(0),
        }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              sessionId: z.string(),
              astName: z.string(),
              configName: z.string().nullable(),
              status: z.string(),
              hostUser: z.string().nullable(),
              runId: z.string().nullable(),
              launcherName: z.string().nullable(),
              executionDate: z.string(),
              startedAt: z.coerce.date(),
              completedAt: z.coerce.date().nullable(),
              totalPolicies: z.number(),
              successCount: z.number(),
              failureCount: z.number(),
              errorCount: z.number(),
              resumedFromId: z.string().nullable(),
            }),
          ),
        },
      },
    },
    async (request) => {
      return executionService.findByUser(
        request.user.id,
        request.query.date,
        request.query.limit,
        request.query.offset,
      )
    },
  )

  typed.get(
    '/history/:id/policies',
    {
      schema: {
        tags: ['History'],
        params: z.object({ id: z.string() }),
        querystring: z.object({
          status: z.string().optional(),
          limit: z.coerce.number().default(100),
          offset: z.coerce.number().default(0),
        }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              policyNumber: z.string(),
              status: z.string(),
              durationMs: z.number(),
              error: z.string().nullable(),
              data: z.unknown().nullable(),
            }),
          ),
        },
      },
    },
    async (request) => {
      return executionService.getPolicies(
        request.params.id,
        request.query.status,
        request.query.limit,
        request.query.offset,
      )
    },
  )

  // Get resume info for a past execution (params + completed count)
  typed.get(
    '/history/:id/resume-info',
    {
      schema: {
        tags: ['History'],
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            canResume: z.boolean(),
            astName: z.string(),
            params: z.unknown().nullable(),
            completedCount: z.number(),
            totalPolicies: z.number(),
            status: z.string(),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const execution = await executionService.findById(request.params.id)
      if (!execution) {
        return reply.status(404).send({ error: 'Execution not found' })
      }

      const resumableStatuses = new Set(['failed', 'cancelled', 'paused', 'running'])
      const canResume = resumableStatuses.has(execution.status)

      return {
        canResume,
        astName: execution.astName,
        params: execution.params ?? null,
        completedCount: execution.successCount,
        totalPolicies: execution.totalPolicies,
        status: execution.status,
      }
    },
  )
}
