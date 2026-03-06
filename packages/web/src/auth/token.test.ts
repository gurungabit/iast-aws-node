import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../config/auth', () => ({
  apiScopes: {
    accessAsUser: ['api://test-scope/.default'],
  },
}))

import { setMsalInstance, getAccessToken } from './token'

interface MockMsal {
  getAllAccounts: ReturnType<typeof vi.fn>
  acquireTokenSilent: ReturnType<typeof vi.fn>
  acquireTokenPopup: ReturnType<typeof vi.fn>
}

function createMockMsal(overrides: Partial<{
  accounts: { username: string }[]
  silentResult: { accessToken: string } | Error
  popupResult: { accessToken: string } | Error
}> = {}): MockMsal {
  const accounts = overrides.accounts ?? [{ username: 'user@test.com' }]
  return {
    getAllAccounts: vi.fn().mockReturnValue(accounts),
    acquireTokenSilent: overrides.silentResult instanceof Error
      ? vi.fn().mockRejectedValue(overrides.silentResult)
      : vi.fn().mockResolvedValue(overrides.silentResult ?? { accessToken: 'silent-token' }),
    acquireTokenPopup: overrides.popupResult instanceof Error
      ? vi.fn().mockRejectedValue(overrides.popupResult)
      : vi.fn().mockResolvedValue(overrides.popupResult ?? { accessToken: 'popup-token' }),
  }
}

/** Wrapper to pass mock objects to setMsalInstance which expects PublicClientApplication */
// @ts-expect-error - mock objects intentionally omit unrelated PublicClientApplication properties
const setMockMsalInstance: (instance: MockMsal) => void = setMsalInstance

describe('token', () => {
  beforeEach(() => {
    // Reset the module-level msalInstance between tests
    setMockMsalInstance(createMockMsal())
  })

  describe('when no MSAL instance is set', () => {
    it('returns "dev-token"', async () => {
      // We need msalInstance to be null. Since setMsalInstance doesn't accept null,
      // we re-import the module. But actually, we can use vi.resetModules.
      // Simpler: the module checks `if (!msalInstance)`.
      // Let's just test with the module as-is from a fresh import.
      vi.resetModules()
      vi.mock('../config/auth', () => ({
        apiScopes: { accessAsUser: ['api://test-scope/.default'] },
      }))
      const freshModule = await import('./token')
      const token = await freshModule.getAccessToken()
      expect(token).toBe('dev-token')
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

    it('falls back to acquireTokenPopup when silent fails', async () => {
      const mock = createMockMsal({
        silentResult: new Error('interaction_required'),
        popupResult: { accessToken: 'popup-token-456' },
      })
      setMockMsalInstance(mock)
      const token = await getAccessToken()

      expect(token).toBe('popup-token-456')
      expect(mock.acquireTokenSilent).toHaveBeenCalled()
      expect(mock.acquireTokenPopup).toHaveBeenCalledWith({
        scopes: ['api://test-scope/.default'],
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

    it('passes correct scopes to acquireTokenSilent', async () => {
      const mock = createMockMsal({ silentResult: { accessToken: 'token' } })
      setMockMsalInstance(mock)
      await getAccessToken()

      expect(mock.acquireTokenSilent).toHaveBeenCalledWith(
        expect.objectContaining({ scopes: ['api://test-scope/.default'] }),
      )
    })

    it('passes correct scopes to acquireTokenPopup on fallback', async () => {
      const mock = createMockMsal({
        silentResult: new Error('fail'),
        popupResult: { accessToken: 'popup-token' },
      })
      setMockMsalInstance(mock)
      await getAccessToken()

      expect(mock.acquireTokenPopup).toHaveBeenCalledWith({
        scopes: ['api://test-scope/.default'],
      })
    })

    it('propagates error from acquireTokenPopup when both methods fail', async () => {
      const mock = createMockMsal({
        silentResult: new Error('silent fail'),
        popupResult: new Error('popup fail'),
      })
      setMockMsalInstance(mock)
      await expect(getAccessToken()).rejects.toThrow('popup fail')
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
