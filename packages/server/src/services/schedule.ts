import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { schedules } from '../db/schema/index.js'

export const scheduleService = {
  async create(data: {
    userId: string
    astName: string
    scheduledTime: Date
    params?: Record<string, unknown>
    encryptedCredentials?: unknown
  }) {
    const [schedule] = await db
      .insert(schedules)
      .values({
        userId: data.userId,
        astName: data.astName,
        scheduledTime: data.scheduledTime,
        params: data.params ?? {},
        encryptedCredentials: data.encryptedCredentials ?? null,
      })
      .returning()
    return schedule
  },

  async findByUser(userId: string) {
    return db.select().from(schedules).where(eq(schedules.userId, userId))
  },

  async findById(id: string) {
    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, id)).limit(1)
    return schedule ?? null
  },

  async updateStatus(id: string, status: string, eventBridgeScheduleName?: string) {
    const updates: Record<string, unknown> = { status, updatedAt: new Date() }
    if (eventBridgeScheduleName) updates.eventBridgeScheduleName = eventBridgeScheduleName
    const [schedule] = await db
      .update(schedules)
      .set(updates)
      .where(eq(schedules.id, id))
      .returning()
    return schedule ?? null
  },

  async remove(id: string, userId: string) {
    const result = await db
      .delete(schedules)
      .where(and(eq(schedules.id, id), eq(schedules.userId, userId)))
      .returning()
    return result.length > 0
  },
}
