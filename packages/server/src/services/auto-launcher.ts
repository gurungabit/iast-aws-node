import { eq, and, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import { autoLaunchers, autoLauncherRuns } from '../db/schema/index.js'

export const autoLauncherService = {
  async create(data: {
    ownerId: string
    name: string
    visibility?: string
    steps?: unknown[]
  }) {
    const [launcher] = await db
      .insert(autoLaunchers)
      .values({
        ownerId: data.ownerId,
        name: data.name,
        visibility: data.visibility ?? 'private',
        steps: data.steps ?? [],
      })
      .returning()
    return launcher
  },

  async findVisible(userId: string) {
    return db
      .select()
      .from(autoLaunchers)
      .where(or(eq(autoLaunchers.ownerId, userId), eq(autoLaunchers.visibility, 'public')))
  },

  async findById(id: string) {
    const [launcher] = await db
      .select()
      .from(autoLaunchers)
      .where(eq(autoLaunchers.id, id))
      .limit(1)
    return launcher ?? null
  },

  async update(
    id: string,
    ownerId: string,
    data: { name?: string; visibility?: string; steps?: unknown[] },
  ) {
    const [launcher] = await db
      .update(autoLaunchers)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(autoLaunchers.id, id), eq(autoLaunchers.ownerId, ownerId)))
      .returning()
    return launcher ?? null
  },

  async remove(id: string, ownerId: string) {
    const result = await db
      .delete(autoLaunchers)
      .where(and(eq(autoLaunchers.id, id), eq(autoLaunchers.ownerId, ownerId)))
      .returning()
    return result.length > 0
  },

  async createRun(data: {
    id: string
    launcherId: string
    userId: string
    sessionId: string
    steps: unknown[]
  }) {
    const [run] = await db.insert(autoLauncherRuns).values(data).returning()
    return run
  },

  async updateRun(
    runId: string,
    data: { status?: string; steps?: unknown[]; currentStepIndex?: string; completedAt?: Date },
  ) {
    const [run] = await db
      .update(autoLauncherRuns)
      .set(data)
      .where(eq(autoLauncherRuns.id, runId))
      .returning()
    return run ?? null
  },

  async findRunsByUser(userId: string, limit = 50, offset = 0) {
    return db
      .select()
      .from(autoLauncherRuns)
      .where(eq(autoLauncherRuns.userId, userId))
      .limit(limit)
      .offset(offset)
  },
}
