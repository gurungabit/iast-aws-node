import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { sql } from 'drizzle-orm'

export const schedules = pgTable(
  'schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    astName: text('ast_name').notNull(),
    scheduledTime: timestamp('scheduled_time', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('pending'),
    params: jsonb('params').notNull().default({}),
    encryptedCredentials: jsonb('encrypted_credentials'),
    eventBridgeScheduleName: text('event_bridge_schedule_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('schedules_user_status_idx').on(t.userId, t.status),
    index('schedules_pending_idx')
      .on(t.status, t.scheduledTime)
      .where(sql`${t.status} = 'pending'`),
  ],
)
