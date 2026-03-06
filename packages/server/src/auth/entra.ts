import { createRemoteJWKSet, jwtVerify, type JWTVerifyResult } from 'jose'
import { config } from '../config.js'

const jwksUrl = `https://login.microsoftonline.com/${config.entraTenantId}/discovery/v2.0/keys`
const jwks = config.entraTenantId ? createRemoteJWKSet(new URL(jwksUrl)) : null

export interface VerifiedToken {
  sub: string
  email: string
  name: string
  oid: string
}

export async function verifyEntraToken(token: string): Promise<VerifiedToken> {
  if (!jwks) {
    throw new Error('Entra ID not configured')
  }

  const { payload } = (await jwtVerify(token, jwks, {
    audience: config.entraAudience || config.entraClientId,
    issuer: `https://login.microsoftonline.com/${config.entraTenantId}/v2.0`,
  })) as JWTVerifyResult & {
    payload: { sub: string; preferred_username?: string; email?: string; name?: string; oid: string }
  }

  return {
    sub: payload.sub,
    email: (payload.preferred_username || payload.email || '') as string,
    name: (payload.name || '') as string,
    oid: payload.oid,
  }
}
