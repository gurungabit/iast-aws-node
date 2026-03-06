import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { sessions } from '../db/schema/index.js'

export const sessionService = {
  async create(sessionId: string, userId: string, name: string = '') {
    const [session] = await db
      .insert(sessions)
      .values({ id: sessionId, userId, name })
      .returning()
    return session
  },

  async findByUser(userId: string) {
    return db.select().from(sessions).where(eq(sessions.userId, userId))
  },

  async findById(sessionId: string) {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
    return session ?? null
  },

  async rename(sessionId: string, userId: string, name: string) {
    const [session] = await db
      .update(sessions)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .returning()
    return session ?? null
  },

  async remove(sessionId: string, userId: string) {
    const result = await db
      .delete(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .returning()
    return result.length > 0
  },
}
