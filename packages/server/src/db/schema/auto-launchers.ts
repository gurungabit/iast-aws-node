import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { sessions } from './sessions.js'
import { sql } from 'drizzle-orm'

export const autoLaunchers = pgTable(
  'auto_launchers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    visibility: text('visibility').notNull().default('private'),
    steps: jsonb('steps').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('auto_launchers_owner_idx').on(t.ownerId),
    index('auto_launchers_public_idx')
      .on(t.visibility)
      .where(sql`${t.visibility} = 'public'`),
  ],
)

export const autoLauncherRuns = pgTable(
  'auto_launcher_runs',
  {
    id: text('id').primaryKey(),
    launcherId: uuid('launcher_id')
      .notNull()
      .references(() => autoLaunchers.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id),
    status: text('status').notNull().default('pending'),
    steps: jsonb('steps').notNull().default([]),
    currentStepIndex: text('current_step_index').notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index('auto_launcher_runs_user_idx').on(t.userId)],
)
