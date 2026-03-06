import { eq, and, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import { astConfigs } from '../db/schema/index.js'

export const astConfigService = {
  async create(data: {
    astName: string
    ownerId: string
    name: string
    visibility?: string
    params?: Record<string, unknown>
    tasks?: unknown[]
  }) {
    const [config] = await db
      .insert(astConfigs)
      .values({
        astName: data.astName,
        ownerId: data.ownerId,
        name: data.name,
        visibility: data.visibility ?? 'private',
        params: data.params ?? {},
        tasks: data.tasks ?? [],
      })
      .returning()
    return config
  },

  async findVisible(userId: string, astName?: string) {
    return db
      .select()
      .from(astConfigs)
      .where(
        and(
          or(eq(astConfigs.ownerId, userId), eq(astConfigs.visibility, 'public')),
          astName ? eq(astConfigs.astName, astName) : undefined,
        ),
      )
  },

  async findById(id: string) {
    const [config] = await db.select().from(astConfigs).where(eq(astConfigs.id, id)).limit(1)
    return config ?? null
  },

  async update(
    id: string,
    ownerId: string,
    data: { name?: string; visibility?: string; params?: Record<string, unknown>; tasks?: unknown[] },
  ) {
    const [config] = await db
      .update(astConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(astConfigs.id, id), eq(astConfigs.ownerId, ownerId)))
      .returning()
    return config ?? null
  },

  async remove(id: string, ownerId: string) {
    const result = await db
      .delete(astConfigs)
      .where(and(eq(astConfigs.id, id), eq(astConfigs.ownerId, ownerId)))
      .returning()
    return result.length > 0
  },

  async clone(id: string, ownerId: string, newName: string) {
    const original = await this.findById(id)
    if (!original) return null

    return this.create({
      astName: original.astName,
      ownerId,
      name: newName,
      visibility: 'private',
      params: original.params as Record<string, unknown>,
      tasks: original.tasks as unknown[],
    })
  },
}
