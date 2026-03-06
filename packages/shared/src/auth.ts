export interface User {
  id: string
  email: string
  displayName: string
  alias: string
  entraId: string
  createdAt: Date
  updatedAt: Date
}

export interface AuthTokenPayload {
  sub: string
  email: string
  name: string
  oid: string
  tid: string
  aud: string
  iss: string
  exp: number
  iat: number
}
