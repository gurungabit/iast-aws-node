import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { executions, policyResults } from '../db/schema/index.js'
import type { ASTItemResult, ASTStatus } from '@iast/shared'

export const executionService = {
  async create(data: {
    id: string
    sessionId: string
    userId: string
    astName: string
    executionDate: string
    hostUser?: string
    runId?: string
  }) {
    const [execution] = await db.insert(executions).values(data).returning()
    return execution
  },

  async updateStatus(
    executionId: string,
    status: ASTStatus,
    counts?: {
      totalPolicies?: number
      successCount?: number
      failureCount?: number
      errorCount?: number
    },
  ) {
    const updates: Record<string, unknown> = { status }
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.completedAt = new Date()
    }
    if (counts) {
      Object.assign(updates, counts)
    }
    const [execution] = await db
      .update(executions)
      .set(updates)
      .where(eq(executions.id, executionId))
      .returning()
    return execution
  },

  async findByUser(userId: string, executionDate?: string, limit = 50, offset = 0) {
    const query = db
      .select()
      .from(executions)
      .where(
        executionDate
          ? and(eq(executions.userId, userId), eq(executions.executionDate, executionDate))
          : eq(executions.userId, userId),
      )
      .orderBy(desc(executions.startedAt))
      .limit(limit)
      .offset(offset)

    return query
  },

  async findById(executionId: string) {
    const [execution] = await db
      .select()
      .from(executions)
      .where(eq(executions.id, executionId))
      .limit(1)
    return execution ?? null
  },

  async batchInsertPolicies(executionId: string, items: ASTItemResult[]) {
    if (items.length === 0) return

    // Only insert policies that don't need PDQ enrichment
    const insertable = items.filter(
      (item) => !(item.data as Record<string, unknown> | null)?.needsPdqEnrichment,
    )

    if (insertable.length > 0) {
      const values = insertable.map((item) => ({
        executionId,
        policyNumber: item.policyNumber,
        status: item.status,
        durationMs: item.durationMs,
        error: item.error ?? null,
        data: item.data ?? null,
      }))

      // Chunk to stay under PostgreSQL's 65,535 param limit (6 params/row → max ~10k rows)
      const CHUNK_SIZE = 5000
      if (values.length <= CHUNK_SIZE) {
        await db.insert(policyResults).values(values)
      } else {
        await db.transaction(async (tx) => {
          for (let i = 0; i < values.length; i += CHUNK_SIZE) {
            await tx.insert(policyResults).values(values.slice(i, i + CHUNK_SIZE))
          }
        })
      }
    }

    // Update counts based on ALL items (including PDQ ones)
    const successCount = items.filter((i) => i.status === 'success').length
    const failureCount = items.filter((i) => i.status === 'failure').length
    const errorCount = items.filter((i) => i.status === 'error').length

    await db
      .update(executions)
      .set({
        totalPolicies: sql`${executions.totalPolicies} + ${items.length}`,
        successCount: sql`${executions.successCount} + ${successCount}`,
        failureCount: sql`${executions.failureCount} + ${failureCount}`,
        errorCount: sql`${executions.errorCount} + ${errorCount}`,
      })
      .where(eq(executions.id, executionId))
  },

  async getPolicies(executionId: string, status?: string, limit = 100, offset = 0) {
    return db
      .select()
      .from(policyResults)
      .where(
        status
          ? and(eq(policyResults.executionId, executionId), eq(policyResults.status, status))
          : eq(policyResults.executionId, executionId),
      )
      .limit(limit)
      .offset(offset)
  },
}
