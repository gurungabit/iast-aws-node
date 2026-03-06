import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '../db/schema/index.js'

interface VerifiedUser {
  sub: string
  email: string
  name: string
  oid: string
}

export const userService = {
  async findOrCreate(verified: VerifiedUser) {
    const existing = await db.select().from(users).where(eq(users.entraId, verified.oid)).limit(1)

    if (existing.length > 0) {
      // Update display name if changed
      if (existing[0].displayName !== verified.name) {
        await db
          .update(users)
          .set({ displayName: verified.name, updatedAt: new Date() })
          .where(eq(users.id, existing[0].id))
      }
      return existing[0]
    }

    const [user] = await db
      .insert(users)
      .values({
        email: verified.email,
        displayName: verified.name,
        entraId: verified.oid,
        alias: verified.email.split('@')[0],
      })
      .returning()

    return user
  },

  async findById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return user ?? null
  },

  async findByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    return user ?? null
  },

  async updateAlias(id: string, alias: string) {
    const [user] = await db
      .update(users)
      .set({ alias, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()
    return user
  },
}
