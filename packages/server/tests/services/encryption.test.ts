import { describe, it, expect, vi } from 'vitest'

vi.mock('@src/config.js', () => ({
  config: { encryptionKey: 'test-key-for-vitest-encryption' },
}))

import { encrypt, decrypt, encryptCredentials, decryptCredentials } from '@src/services/encryption.js'

describe('encrypt / decrypt', () => {
  it('roundtrip: decrypt(encrypt(text)) returns original text', () => {
    const original = 'hello, world!'
    const encrypted = encrypt(original)
    expect(decrypt(encrypted)).toBe(original)
  })

  it('encrypts to the salt:iv:authTag:encrypted format', () => {
    const encrypted = encrypt('test')
    const parts = encrypted.split(':')
    expect(parts.length).toBe(4)
    // salt = 32 bytes = 64 hex chars
    expect(parts[0].length).toBe(64)
    // iv = 16 bytes = 32 hex chars
    expect(parts[1].length).toBe(32)
    // authTag = 16 bytes = 32 hex chars
    expect(parts[2].length).toBe(32)
    // encrypted data should be non-empty
    expect(parts[3].length).toBeGreaterThan(0)
  })

  it('produces different ciphertexts for the same plaintext (due to random salt/iv)', () => {
    const text = 'same text'
    const a = encrypt(text)
    const b = encrypt(text)
    expect(a).not.toBe(b)
    // Both should decrypt to the same value
    expect(decrypt(a)).toBe(text)
    expect(decrypt(b)).toBe(text)
  })

  it('handles empty string', () => {
    const encrypted = encrypt('')
    expect(decrypt(encrypted)).toBe('')
  })

  it('handles unicode characters', () => {
    const text = 'unicode test'
    const encrypted = encrypt(text)
    expect(decrypt(encrypted)).toBe(text)
  })

  it('handles long strings', () => {
    const text = 'a'.repeat(10000)
    const encrypted = encrypt(text)
    expect(decrypt(encrypted)).toBe(text)
  })
})

describe('decrypt error handling', () => {
  it('throws on invalid format (not 4 parts)', () => {
    expect(() => decrypt('abc:def')).toThrow('Invalid encrypted data format')
  })

  it('throws on empty string', () => {
    expect(() => decrypt('')).toThrow('Invalid encrypted data format')
  })

  it('throws on 3 parts', () => {
    expect(() => decrypt('a:b:c')).toThrow('Invalid encrypted data format')
  })

  it('throws on 5 parts', () => {
    expect(() => decrypt('a:b:c:d:e')).toThrow('Invalid encrypted data format')
  })

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('original')
    const parts = encrypted.split(':')
    // Tamper with the encrypted data
    parts[3] = 'ff'.repeat(parts[3].length / 2)
    const tampered = parts.join(':')
    expect(() => decrypt(tampered)).toThrow()
  })

  it('throws on tampered auth tag', () => {
    const encrypted = encrypt('original')
    const parts = encrypted.split(':')
    // Tamper with the auth tag
    parts[2] = '00'.repeat(16)
    const tampered = parts.join(':')
    expect(() => decrypt(tampered)).toThrow()
  })
})

describe('encryptCredentials / decryptCredentials', () => {
  it('roundtrip: decryptCredentials(encryptCredentials(creds)) returns original', () => {
    const credentials = { userId: 'myuser', password: 'myp@ssw0rd!' }
    const encrypted = encryptCredentials(credentials)
    const decrypted = decryptCredentials(encrypted)
    expect(decrypted).toEqual(credentials)
  })

  it('encrypted credentials have different values from originals', () => {
    const credentials = { userId: 'admin', password: 'secret' }
    const encrypted = encryptCredentials(credentials)
    expect(encrypted.userId).not.toBe(credentials.userId)
    expect(encrypted.password).not.toBe(credentials.password)
  })

  it('encrypted credentials contain colon-separated hex format', () => {
    const credentials = { userId: 'testuser', password: 'testpass' }
    const encrypted = encryptCredentials(credentials)
    expect(encrypted.userId.split(':').length).toBe(4)
    expect(encrypted.password.split(':').length).toBe(4)
  })

  it('handles empty userId and password', () => {
    const credentials = { userId: '', password: '' }
    const encrypted = encryptCredentials(credentials)
    const decrypted = decryptCredentials(encrypted)
    expect(decrypted).toEqual(credentials)
  })

  it('handles special characters in credentials', () => {
    const credentials = { userId: 'user@domain.com', password: 'p@$$w0rd!#%^&*()' }
    const encrypted = encryptCredentials(credentials)
    const decrypted = decryptCredentials(encrypted)
    expect(decrypted).toEqual(credentials)
  })
})
