import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { sessions } from './sessions.js'

export const executions = pgTable(
  'executions',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    astName: text('ast_name').notNull(),
    status: text('status').notNull().default('running'),
    hostUser: text('host_user'),
    runId: text('run_id'),
    executionDate: text('execution_date').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    totalPolicies: integer('total_policies').notNull().default(0),
    successCount: integer('success_count').notNull().default(0),
    failureCount: integer('failure_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
  },
  (t) => [
    index('executions_user_date_idx').on(t.userId, t.executionDate),
    index('executions_session_status_idx').on(t.sessionId, t.status),
    index('executions_run_id_idx').on(t.runId),
  ],
)
