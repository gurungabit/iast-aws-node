import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    verifyEntraToken: vi.fn(),
    userService: {
      findOrCreate: vi.fn(),
    },
  }
})

vi.mock('./entra.js', () => ({
  verifyEntraToken: mocks.verifyEntraToken,
}))

vi.mock('../services/user.js', () => ({
  userService: mocks.userService,
}))

import { verifyWsToken } from './ws-auth.js'

describe('verifyWsToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null when token is undefined', async () => {
    const result = await verifyWsToken(undefined)
    expect(result).toBeNull()
  })

  it('should return user from verifyEntraToken + userService.findOrCreate on success', async () => {
    const verified = {
      sub: 'sub-123',
      email: 'user@example.com',
      name: 'User Name',
      oid: 'oid-456',
    }
    const user = {
      id: 'user-id-789',
      email: 'user@example.com',
      displayName: 'User Name',
      entraId: 'oid-456',
    }

    mocks.verifyEntraToken.mockResolvedValue(verified)
    mocks.userService.findOrCreate.mockResolvedValue(user)

    const result = await verifyWsToken('valid-token')
    expect(result).toEqual({
      id: 'user-id-789',
      email: 'user@example.com',
      displayName: 'User Name',
      entraId: 'oid-456',
    })
  })

  it('should call verifyEntraToken with the provided token', async () => {
    mocks.verifyEntraToken.mockResolvedValue({
      sub: 's',
      email: 'e',
      name: 'n',
      oid: 'o',
    })
    mocks.userService.findOrCreate.mockResolvedValue({
      id: 'id',
      email: 'e',
      displayName: 'n',
      entraId: 'o',
    })

    await verifyWsToken('my-token')
    expect(mocks.verifyEntraToken).toHaveBeenCalledWith('my-token')
  })

  it('should pass verified token to userService.findOrCreate', async () => {
    const verified = { sub: 's', email: 'e', name: 'n', oid: 'o' }
    mocks.verifyEntraToken.mockResolvedValue(verified)
    mocks.userService.findOrCreate.mockResolvedValue({
      id: 'id',
      email: 'e',
      displayName: 'n',
      entraId: 'o',
    })

    await verifyWsToken('token')
    expect(mocks.userService.findOrCreate).toHaveBeenCalledWith(verified)
  })

  it('should return null when verifyEntraToken throws', async () => {
    mocks.verifyEntraToken.mockRejectedValue(new Error('Invalid token'))

    const result = await verifyWsToken('bad-token')
    expect(result).toBeNull()
  })

  it('should return null when userService.findOrCreate throws', async () => {
    mocks.verifyEntraToken.mockResolvedValue({
      sub: 's',
      email: 'e',
      name: 'n',
      oid: 'o',
    })
    mocks.userService.findOrCreate.mockRejectedValue(new Error('DB error'))

    const result = await verifyWsToken('token')
    expect(result).toBeNull()
  })

  it('should not call verifyEntraToken when token is undefined', async () => {
    await verifyWsToken(undefined)
    expect(mocks.verifyEntraToken).not.toHaveBeenCalled()
  })
})
