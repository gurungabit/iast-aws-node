import { eq, and, or, desc, asc, sql } from 'drizzle-orm'
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

  async queryDataInquiry(
    userId: string,
    params: {
      astName: string
      filters: Array<{ field: string; op: string; value: string }>
      sort: Array<{ column: string; direction: 'asc' | 'desc' }>
      limit: number
      offset: number
    },
  ) {
    const ALLOWED_FIELDS = new Set([
      'officeNum',
      'policyNumber',
      'policyNumberFmt',
      'policyItem',
      'sectionOfRout',
      'policyType',
      'status',
      'gfuDate',
      'gfuCode',
      'agentNafo',
      'description',
      'errorCode1',
      'errorCode2',
      'errorCode3',
      'errorCode4',
      'errorCode5',
      'errorCode6',
      'errorCode7',
      'errorCode8',
      'flmpCode',
      'queueName',
      'queueDetail',
      'servOrUndr',
      'systemPolicyType',
      'systemFormLine',
      'noOfErrors',
      'pui',
      'companyCode',
      'team',
      'agent',
      'afo',
      'stateCode',
      'annivDate',
      'statusCode',
      'dateOfRun',
    ])

    const ERROR_FIELDS = [
      'errorCode1',
      'errorCode2',
      'errorCode3',
      'errorCode4',
      'errorCode5',
      'errorCode6',
      'errorCode7',
      'errorCode8',
    ]

    // Base conditions: user + AST
    const conditions = [eq(executions.userId, userId), eq(executions.astName, params.astName)]

    // JSONB filter conditions
    for (const filter of params.filters) {
      const val = filter.value
      if (!val) continue

      // Special: search across all 8 error code fields
      if (filter.field === '_anyError') {
        if (filter.op === 'eq') {
          const parts = ERROR_FIELDS.map((f) => sql`${policyResults.data}->>${f} = ${val}`)
          const combined = or(...parts)
          if (combined) conditions.push(combined)
        } else if (filter.op === 'contains') {
          const escaped = val.replace(/[%_\\]/g, '\\$&')
          const pattern = '%' + escaped + '%'
          const parts = ERROR_FIELDS.map((f) => sql`${policyResults.data}->>${f} ILIKE ${pattern}`)
          const combined = or(...parts)
          if (combined) conditions.push(combined)
        }
        continue
      }

      if (!ALLOWED_FIELDS.has(filter.field)) continue

      switch (filter.op) {
        case 'eq':
          conditions.push(sql`${policyResults.data}->>${filter.field} = ${val}`)
          break
        case 'neq':
          conditions.push(sql`${policyResults.data}->>${filter.field} != ${val}`)
          break
        case 'contains': {
          const escaped = val.replace(/[%_\\]/g, '\\$&')
          conditions.push(sql`${policyResults.data}->>${filter.field} ILIKE ${'%' + escaped + '%'}`)
          break
        }
        case 'starts_with': {
          const escaped = val.replace(/[%_\\]/g, '\\$&')
          conditions.push(sql`${policyResults.data}->>${filter.field} ILIKE ${escaped + '%'}`)
          break
        }
      }
    }

    const whereClause = and(...conditions)!

    // Sort: validate columns, default to policyNumber ASC
    const orderClauses = params.sort
      .filter((s) => ALLOWED_FIELDS.has(s.column))
      .map((s) => {
        const col = sql`${policyResults.data}->>${s.column}`
        return s.direction === 'asc' ? asc(col) : desc(col)
      })

    if (orderClauses.length === 0) {
      orderClauses.push(asc(policyResults.policyNumber))
    }

    // Data query
    const rows = await db
      .select({
        id: policyResults.id,
        policyNumber: policyResults.policyNumber,
        executionDate: executions.executionDate,
        data: policyResults.data,
      })
      .from(policyResults)
      .innerJoin(executions, eq(policyResults.executionId, executions.id))
      .where(whereClause)
      .orderBy(...orderClauses)
      .limit(params.limit)
      .offset(params.offset)

    // Count query
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(policyResults)
      .innerJoin(executions, eq(policyResults.executionId, executions.id))
      .where(whereClause)

    return {
      rows,
      total: countRow?.count ?? 0,
    }
  },
}
