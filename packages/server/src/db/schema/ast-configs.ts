import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { sql } from 'drizzle-orm'

export const astConfigs = pgTable(
  'ast_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    astName: text('ast_name').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    visibility: text('visibility').notNull().default('private'),
    params: jsonb('params').notNull().default({}),
    tasks: jsonb('tasks').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ast_configs_owner_ast_idx').on(t.ownerId, t.astName),
    index('ast_configs_public_idx')
      .on(t.visibility)
      .where(sql`${t.visibility} = 'public'`),
  ],
)
