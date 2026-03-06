import { verifyEntraToken } from './entra.js'
import { userService } from '../services/user.js'

export async function verifyWsToken(
  token: string | undefined,
): Promise<{ id: string; email: string; displayName: string; entraId: string } | null> {
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
