import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { sessions } from './sessions.js'
import { sql } from 'drizzle-orm'

export const sessionAssignments = pgTable(
  'session_assignments',
  {
    sessionId: text('session_id')
      .primaryKey()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    podIp: text('pod_ip').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('session_assignments_pod_status_idx')
      .on(t.podIp, t.status)
      .where(sql`${t.status} = 'active'`),
  ],
)
