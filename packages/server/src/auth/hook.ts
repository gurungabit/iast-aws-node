import type { FastifyRequest, FastifyReply } from 'fastify'
import { verifyEntraToken } from './entra.js'
import { userService } from '../services/user.js'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  entraId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser
  }
}

export async function authHook(request: FastifyRequest, reply: FastifyReply) {
  // Skip auth for health/docs routes
  if (
    request.url === '/health' ||
    request.url === '/ping' ||
    request.url === '/metrics' ||
    request.url.startsWith('/docs') ||
    request.url.startsWith('/api/terminal/')
  ) {
    return
  }

  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } })
  }

  let verified
  try {
    const token = authHeader.slice(7)
    verified = await verifyEntraToken(token)
  } catch (err) {
    request.log.warn({ err }, 'Token verification failed')
    return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } })
  }

  try {
    const user = await userService.findOrCreate(verified)
    request.user = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      entraId: user.entraId,
    }
  } catch (err) {
    request.log.error({ err }, 'Failed to find/create user after successful token verification')
    return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'User provisioning failed' } })
  }
}
