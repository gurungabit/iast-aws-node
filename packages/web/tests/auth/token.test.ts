import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@src/config/auth', () => ({
  loginRequest: { scopes: ['api://test-scope/.default'] },
}))

import { setMsalInstance, getAccessToken } from '@src/auth/token'

interface MockMsal {
  getAllAccounts: ReturnType<typeof vi.fn>
  acquireTokenSilent: ReturnType<typeof vi.fn>
  acquireTokenRedirect: ReturnType<typeof vi.fn>
}

function createMockMsal(overrides: Partial<{
  accounts: { username: string }[]
  silentResult: { accessToken: string } | Error
}> = {}): MockMsal {
  const accounts = overrides.accounts ?? [{ username: 'user@test.com' }]
  return {
    getAllAccounts: vi.fn().mockReturnValue(accounts),
    acquireTokenSilent: overrides.silentResult instanceof Error
      ? vi.fn().mockRejectedValue(overrides.silentResult)
      : vi.fn().mockResolvedValue(overrides.silentResult ?? { accessToken: 'silent-token' }),
    acquireTokenRedirect: vi.fn().mockResolvedValue(undefined),
  }
}

// @ts-expect-error - mock objects intentionally omit unrelated PublicClientApplication properties
const setMockMsalInstance: (instance: MockMsal) => void = setMsalInstance

describe('token', () => {
  beforeEach(() => {
    setMockMsalInstance(createMockMsal())
  })

  describe('when no MSAL instance is set', () => {
    it('throws MSAL not initialized', async () => {
      vi.resetModules()
      vi.mock('@src/config/auth', () => ({
        loginRequest: { scopes: ['api://test-scope/.default'] },
      }))
      const freshModule = await import('@src/auth/token')
      await expect(freshModule.getAccessToken()).rejects.toThrow('MSAL not initialized')
    })
  })

  describe('when MSAL instance is set', () => {
    it('acquireTokenSilent succeeds and returns access token', async () => {
      const mock = createMockMsal({ silentResult: { accessToken: 'silent-token-123' } })
      setMockMsalInstance(mock)
      const token = await getAccessToken()

      expect(token).toBe('silent-token-123')
      expect(mock.acquireTokenSilent).toHaveBeenCalledWith({
        scopes: ['api://test-scope/.default'],
        account: { username: 'user@test.com' },
      })
    })

    it('falls back to acquireTokenRedirect when silent fails', async () => {
      const mock = createMockMsal({
        silentResult: new Error('interaction_required'),
      })
      setMockMsalInstance(mock)

      await expect(getAccessToken()).rejects.toThrow('Redirecting for authentication')
      expect(mock.acquireTokenSilent).toHaveBeenCalled()
      expect(mock.acquireTokenRedirect).toHaveBeenCalledWith({
        scopes: ['api://test-scope/.default'],
        account: { username: 'user@test.com' },
      })
    })

    it('throws when no accounts are found', async () => {
      const mock = createMockMsal({ accounts: [] })
      setMockMsalInstance(mock)
      await expect(getAccessToken()).rejects.toThrow('No accounts found')
    })

    it('calls acquireTokenSilent with the first account', async () => {
      const mock = createMockMsal({
        accounts: [{ username: 'first@test.com' }, { username: 'second@test.com' }],
        silentResult: { accessToken: 'token' },
      })
      setMockMsalInstance(mock)
      await getAccessToken()

      expect(mock.acquireTokenSilent).toHaveBeenCalledWith(
        expect.objectContaining({ account: { username: 'first@test.com' } }),
      )
    })
  })

  describe('setMsalInstance', () => {
    it('sets the instance for subsequent getAccessToken calls', async () => {
      const mock = createMockMsal({ silentResult: { accessToken: 'real-token' } })
      setMockMsalInstance(mock)

      const realToken = await getAccessToken()
      expect(realToken).toBe('real-token')
    })
  })
})
