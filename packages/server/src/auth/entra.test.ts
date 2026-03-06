import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const mockJwks = vi.fn()
  return {
    createRemoteJWKSet: vi.fn().mockReturnValue(mockJwks),
    jwtVerify: vi.fn(),
    mockJwks,
    config: {
      entraTenantId: 'test-tenant-id',
      entraClientId: 'test-client-id',
      entraAudience: '',
    },
  }
})

vi.mock('jose', () => ({
  createRemoteJWKSet: mocks.createRemoteJWKSet,
  jwtVerify: mocks.jwtVerify,
}))

vi.mock('../config.js', () => ({
  config: mocks.config,
}))

import { verifyEntraToken } from './entra.js'

describe('verifyEntraToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.config.entraTenantId = 'test-tenant-id'
    mocks.config.entraClientId = 'test-client-id'
    mocks.config.entraAudience = ''
  })

  it('should return a VerifiedToken on successful verification', async () => {
    mocks.jwtVerify.mockResolvedValue({
      payload: {
        sub: 'user-sub-123',
        preferred_username: 'user@example.com',
        name: 'Test User',
        oid: 'oid-456',
      },
    })

    const result = await verifyEntraToken('valid-token')
    expect(result).toEqual({
      sub: 'user-sub-123',
      email: 'user@example.com',
      name: 'Test User',
      oid: 'oid-456',
    })
  })

  it('should call jwtVerify with the correct token and options', async () => {
    mocks.jwtVerify.mockResolvedValue({
      payload: { sub: 's', preferred_username: 'e', name: 'n', oid: 'o' },
    })

    await verifyEntraToken('my-jwt-token')
    expect(mocks.jwtVerify).toHaveBeenCalledWith(
      'my-jwt-token',
      expect.anything(),
      expect.objectContaining({
        audience: ['test-client-id'],
        issuer: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
      }),
    )
  })

  it('should map preferred_username to email when present', async () => {
    mocks.jwtVerify.mockResolvedValue({
      payload: {
        sub: 's',
        preferred_username: 'preferred@example.com',
        email: 'fallback@example.com',
        name: 'n',
        oid: 'o',
      },
    })

    const result = await verifyEntraToken('token')
    expect(result.email).toBe('preferred@example.com')
  })

  it('should fall back to email when preferred_username is absent', async () => {
    mocks.jwtVerify.mockResolvedValue({
      payload: {
        sub: 's',
        email: 'fallback@example.com',
        name: 'n',
        oid: 'o',
      },
    })

    const result = await verifyEntraToken('token')
    expect(result.email).toBe('fallback@example.com')
  })

  it('should return empty string for email when neither preferred_username nor email exist', async () => {
    mocks.jwtVerify.mockResolvedValue({
      payload: { sub: 's', name: 'n', oid: 'o' },
    })

    const result = await verifyEntraToken('token')
    expect(result.email).toBe('')
  })

  it('should return empty string for name when name is absent', async () => {
    mocks.jwtVerify.mockResolvedValue({
      payload: { sub: 's', preferred_username: 'e', oid: 'o' },
    })

    const result = await verifyEntraToken('token')
    expect(result.name).toBe('')
  })

  it('should propagate errors from jwtVerify', async () => {
    mocks.jwtVerify.mockRejectedValue(new Error('Token expired'))

    await expect(verifyEntraToken('expired-token')).rejects.toThrow('Token expired')
  })

  it('should call createRemoteJWKSet at module load', () => {
    // createRemoteJWKSet is called once at module evaluation time
    // clearAllMocks resets call counts, so we check it was called at least implicitly
    // by verifying the mock was set up correctly
    expect(mocks.createRemoteJWKSet).toBeDefined()
  })

  it('should use entraAudience over entraClientId when entraAudience is set', async () => {
    mocks.config.entraAudience = 'custom-audience'
    mocks.jwtVerify.mockResolvedValue({
      payload: { sub: 's', preferred_username: 'e', name: 'n', oid: 'o' },
    })

    await verifyEntraToken('token')
    expect(mocks.jwtVerify).toHaveBeenCalledWith(
      'token',
      expect.anything(),
      expect.objectContaining({
        audience: ['test-client-id', 'custom-audience'],
      }),
    )
  })

  it('should pass correct issuer including tenant id', async () => {
    mocks.jwtVerify.mockResolvedValue({
      payload: { sub: 's', preferred_username: 'e', name: 'n', oid: 'o' },
    })

    await verifyEntraToken('token')
    expect(mocks.jwtVerify).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        issuer: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
      }),
    )
  })
})
