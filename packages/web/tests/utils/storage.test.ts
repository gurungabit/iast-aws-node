import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getStorageItem, setStorageItem, removeStorageItem } from '@src/utils/storage'

describe('storage utilities', () => {
  const mockStorage: Record<string, string> = {}

  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return mockStorage[key] ?? null
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      mockStorage[key] = value
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      delete mockStorage[key]
    })
  })

  describe('getStorageItem', () => {
    it('returns parsed JSON for a valid stored value', () => {
      mockStorage['key1'] = JSON.stringify({ name: 'test' })
      expect(getStorageItem('key1', null)).toEqual({ name: 'test' })
    })

    it('returns fallback for missing key', () => {
      expect(getStorageItem('nonexistent', 'default')).toBe('default')
    })

    it('returns fallback for invalid JSON', () => {
      mockStorage['bad'] = 'not valid json{{'
      expect(getStorageItem('bad', 42)).toBe(42)
    })

    it('returns stored number', () => {
      mockStorage['num'] = '123'
      expect(getStorageItem('num', 0)).toBe(123)
    })

    it('returns stored boolean', () => {
      mockStorage['bool'] = 'true'
      expect(getStorageItem('bool', false)).toBe(true)
    })

    it('returns stored array', () => {
      mockStorage['arr'] = JSON.stringify([1, 2, 3])
      expect(getStorageItem('arr', [])).toEqual([1, 2, 3])
    })

    it('returns fallback when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage error')
      })
      expect(getStorageItem('key', 'fallback')).toBe('fallback')
    })
  })

  describe('setStorageItem', () => {
    it('stores a value as JSON', () => {
      setStorageItem('myKey', { foo: 'bar' })
      expect(mockStorage['myKey']).toBe(JSON.stringify({ foo: 'bar' }))
    })

    it('stores a string value', () => {
      setStorageItem('str', 'hello')
      expect(mockStorage['str']).toBe('"hello"')
    })

    it('stores a number value', () => {
      setStorageItem('num', 42)
      expect(mockStorage['num']).toBe('42')
    })

    it('handles localStorage.setItem throwing without error', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('storage full')
      })
      expect(() => setStorageItem('key', 'val')).not.toThrow()
    })
  })

  describe('removeStorageItem', () => {
    it('removes a stored item', () => {
      mockStorage['toRemove'] = '"value"'
      removeStorageItem('toRemove')
      expect(mockStorage['toRemove']).toBeUndefined()
    })

    it('handles removal of nonexistent key without error', () => {
      expect(() => removeStorageItem('nope')).not.toThrow()
    })

    it('handles localStorage.removeItem throwing without error', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('storage error')
      })
      expect(() => removeStorageItem('key')).not.toThrow()
    })
  })
})
