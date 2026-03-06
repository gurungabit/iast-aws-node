import { verifyEntraToken } from './entra.js'
import { config } from '../config.js'
import { userService } from '../services/user.js'

export async function verifyWsToken(
  token: string | undefined,
): Promise<{ id: string; email: string; displayName: string; entraId: string } | null> {
  // Dev mode bypass
  if (!config.entraTenantId) {
    return {
      id: 'dev-user-id',
      email: 'dev@local',
      displayName: 'Dev User',
      entraId: 'dev-oid',
    }
  }

  if (!token) return null

  try {
    const verified = await verifyEntraToken(token)
    const user = await userService.findOrCreate(verified)
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      entraId: user.entraId,
    }
  } catch {
    return null
  }
}
