import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { executionService } from '../services/execution.js'

const filterSchema = z.object({
  field: z.string(),
  op: z.enum(['eq', 'neq', 'contains', 'starts_with']),
  value: z.string(),
})

const sortSchema = z.object({
  column: z.string(),
  direction: z.enum(['asc', 'desc']),
})

export async function dataInquiryRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()

  typed.post(
    '/data-inquiry',
    {
      schema: {
        tags: ['Data Inquiry'],
        body: z.object({
          astName: z.string().default('rout_extractor'),
          filters: z.array(filterSchema).default([]),
          sort: z.array(sortSchema).default([]),
          limit: z.coerce.number().min(1).max(5000).default(1000),
          offset: z.coerce.number().min(0).default(0),
        }),
        response: {
          200: z.object({
            rows: z.array(
              z.object({
                id: z.string(),
                policyNumber: z.string(),
                executionDate: z.string(),
                data: z.unknown().nullable(),
              }),
            ),
            total: z.number(),
          }),
        },
      },
    },
    async (request) => {
      return executionService.queryDataInquiry(request.user.id, request.body)
    },
  )
}
