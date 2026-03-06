import { index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { executions } from './executions.js'

export const policyResults = pgTable(
  'policy_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    executionId: text('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    policyNumber: text('policy_number').notNull(),
    status: text('status').notNull(),
    durationMs: integer('duration_ms').notNull().default(0),
    error: text('error'),
    data: jsonb('data'),
  },
  (t) => [index('policy_results_execution_status_idx').on(t.executionId, t.status)],
)
