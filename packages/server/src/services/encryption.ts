import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { config } from '../config.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 32

function deriveKey(salt: Buffer): Buffer {
  return scryptSync(config.encryptionKey, salt, 32)
}

export function encrypt(text: string): string {
  const salt = randomBytes(SALT_LENGTH)
  const key = deriveKey(salt)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  // Format: salt:iv:authTag:encrypted
  return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(data: string): string {
  const parts = data.split(':')
  if (parts.length !== 4) throw new Error('Invalid encrypted data format')

  const salt = Buffer.from(parts[0], 'hex')
  const iv = Buffer.from(parts[1], 'hex')
  const authTag = Buffer.from(parts[2], 'hex')
  const encrypted = parts[3]

  const key = deriveKey(salt)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export function encryptCredentials(credentials: { userId: string; password: string }) {
  return {
    userId: encrypt(credentials.userId),
    password: encrypt(credentials.password),
  }
}

export function decryptCredentials(encrypted: { userId: string; password: string }) {
  return {
    userId: decrypt(encrypted.userId),
    password: decrypt(encrypted.password),
  }
}
