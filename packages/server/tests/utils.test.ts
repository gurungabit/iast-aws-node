import { describe, it, expect } from 'vitest'
import { generateSessionId, generateExecutionId, generateRunId, todayDateString } from '@src/utils.js'

describe('generateSessionId', () => {
  it('returns a string starting with "ses_"', () => {
    const id = generateSessionId()
    expect(id).toMatch(/^ses_/)
  })

  it('has a hex suffix of 8 characters (4 random bytes)', () => {
    const id = generateSessionId()
    expect(id).toMatch(/^ses_[0-9a-f]{8}$/)
  })

  it('generates unique ids on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSessionId()))
    expect(ids.size).toBe(100)
  })
})

describe('generateExecutionId', () => {
  it('returns a string starting with "exe_"', () => {
    const id = generateExecutionId()
    expect(id).toMatch(/^exe_/)
  })

  it('has a hex suffix of 12 characters (6 random bytes)', () => {
    const id = generateExecutionId()
    expect(id).toMatch(/^exe_[0-9a-f]{12}$/)
  })

  it('generates unique ids on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateExecutionId()))
    expect(ids.size).toBe(100)
  })
})

describe('generateRunId', () => {
  it('returns a string starting with "run_"', () => {
    const id = generateRunId()
    expect(id).toMatch(/^run_/)
  })

  it('has a hex suffix of 12 characters (6 random bytes)', () => {
    const id = generateRunId()
    expect(id).toMatch(/^run_[0-9a-f]{12}$/)
  })

  it('generates unique ids on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRunId()))
    expect(ids.size).toBe(100)
  })
})

describe('todayDateString', () => {
  it('returns a date string in YYYY-MM-DD format', () => {
    const result = todayDateString()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns today\'s date', () => {
    const result = todayDateString()
    const expected = new Date().toISOString().slice(0, 10)
    expect(result).toBe(expected)
  })

  it('returns a 10-character string', () => {
    const result = todayDateString()
    expect(result.length).toBe(10)
  })
})
