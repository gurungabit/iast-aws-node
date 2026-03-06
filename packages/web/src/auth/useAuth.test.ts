import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const msalMocks = vi.hoisted(() => ({
  acquireTokenSilent: vi.fn(),
  acquireTokenRedirect: vi.fn(),
  ssoSilent: vi.fn(),
  loginRedirect: vi.fn(),
  logoutRedirect: vi.fn(),
}))

vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({
    instance: {
      acquireTokenSilent: msalMocks.acquireTokenSilent,
      acquireTokenRedirect: msalMocks.acquireTokenRedirect,
      ssoSilent: msalMocks.ssoSilent,
      loginRedirect: msalMocks.loginRedirect,
      logoutRedirect: msalMocks.logoutRedirect,
    },
    accounts: [{
      localAccountId: 'user-123',
      name: 'Test User',
      username: 'test@example.com',
    }],
    inProgress: 'none',
  }),
}))

vi.mock('@azure/msal-browser', () => ({
  InteractionStatus: { None: 'none' },
  InteractionRequiredAuthError: class InteractionRequiredAuthError extends Error {},
}))

vi.mock('../config/auth', () => ({
  loginRequest: { scopes: ['test-scope'] },
}))

import { useAuth } from './useAuth'

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    msalMocks.acquireTokenSilent.mockResolvedValue({ accessToken: 'test-token' })
  })

  it('returns authenticated state from MSAL', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('returns user from MSAL accounts', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toEqual({
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
    })
  })

  it('getAccessToken calls acquireTokenSilent', async () => {
    const { result } = renderHook(() => useAuth())
    let token: string | null = null
    await act(async () => {
      token = await result.current.getAccessToken()
    })
    expect(token).toBe('test-token')
    expect(msalMocks.acquireTokenSilent).toHaveBeenCalled()
  })

  it('getAccessToken falls back to redirect on InteractionRequired error', async () => {
    const { InteractionRequiredAuthError } = await import('@azure/msal-browser')
    msalMocks.acquireTokenSilent.mockRejectedValueOnce(new InteractionRequiredAuthError('interaction_required'))
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.getAccessToken()
    })
    expect(msalMocks.acquireTokenRedirect).toHaveBeenCalled()
  })

  it('login tries ssoSilent first', async () => {
    msalMocks.ssoSilent.mockResolvedValueOnce({})
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.login()
    })
    expect(msalMocks.ssoSilent).toHaveBeenCalled()
    expect(msalMocks.loginRedirect).not.toHaveBeenCalled()
  })

  it('login falls back to loginRedirect when ssoSilent fails', async () => {
    msalMocks.ssoSilent.mockRejectedValueOnce(new Error('no session'))
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.login()
    })
    expect(msalMocks.ssoSilent).toHaveBeenCalled()
    expect(msalMocks.loginRedirect).toHaveBeenCalled()
  })

  it('logout calls logoutRedirect', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.logout()
    })
    expect(msalMocks.logoutRedirect).toHaveBeenCalled()
  })

  it('sets isLoading to false when inProgress is None', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.isLoading).toBe(false)
  })
})
