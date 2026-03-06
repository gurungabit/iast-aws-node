import { describe, it, expect } from 'vitest'
import { msalConfig, loginRequest } from './auth'

describe('auth config', () => {
  describe('msalConfig', () => {
    it('has auth property', () => {
      expect(msalConfig.auth).toBeDefined()
    })

    it('has clientId in auth', () => {
      expect(msalConfig.auth.clientId).toBeDefined()
      expect(typeof msalConfig.auth.clientId).toBe('string')
    })

    it('has authority in auth', () => {
      expect(msalConfig.auth.authority).toBeDefined()
      expect(typeof msalConfig.auth.authority).toBe('string')
      expect(msalConfig.auth.authority).toContain('https://login.microsoftonline.com/')
    })

    it('has redirectUri in auth', () => {
      expect(msalConfig.auth.redirectUri).toBeDefined()
    })

    it('has postLogoutRedirectUri in auth', () => {
      expect(msalConfig.auth.postLogoutRedirectUri).toBeDefined()
    })

    it('has cache configuration', () => {
      expect(msalConfig.cache).toBeDefined()
      expect(msalConfig.cache!.cacheLocation).toBe('localStorage')
    })

    it('has system logger configuration', () => {
      expect(msalConfig.system).toBeDefined()
      expect(msalConfig.system!.loggerOptions).toBeDefined()
    })
  })

  describe('loginRequest', () => {
    it('has scopes array', () => {
      expect(loginRequest.scopes).toBeDefined()
      expect(Array.isArray(loginRequest.scopes)).toBe(true)
    })

    it('has at least one scope', () => {
      expect(loginRequest.scopes.length).toBeGreaterThan(0)
    })

    it('scopes contains strings', () => {
      loginRequest.scopes.forEach((scope) => {
        expect(typeof scope).toBe('string')
      })
    })
  })
})
