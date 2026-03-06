import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from './index.js'

export async function runMigrations() {
  await migrate(db, { migrationsFolder: './drizzle' })
}
