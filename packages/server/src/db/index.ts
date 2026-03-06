import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from '../config.js'
import * as schema from './schema/index.js'

const queryClient = postgres(config.databaseUrl)

export const db = drizzle(queryClient, { schema })
export type Database = typeof db

export async function checkDbConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`
    return true
  } catch {
    return false
  }
}
