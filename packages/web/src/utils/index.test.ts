import { describe, it, expect } from 'vitest'
import { cn, formatDuration, formatDate, formatTime } from './index'

describe('cn', () => {
  it('joins multiple class strings', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz')
  })

  it('filters out falsy values', () => {
    expect(cn('foo', false, undefined, null, 'bar')).toBe('foo bar')
  })

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, undefined, null)).toBe('')
  })

  it('returns empty string when no arguments', () => {
    expect(cn()).toBe('')
  })

  it('handles single class', () => {
    expect(cn('only')).toBe('only')
  })
})

describe('formatDuration', () => {
  it('formats milliseconds for values under 1000', () => {
    expect(formatDuration(0)).toBe('0ms')
    expect(formatDuration(500)).toBe('500ms')
    expect(formatDuration(999)).toBe('999ms')
  })

  it('formats seconds for values under 60 seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s')
    expect(formatDuration(1500)).toBe('1.5s')
    expect(formatDuration(59999)).toBe('60.0s')
  })

  it('formats minutes and seconds for values >= 60 seconds', () => {
    expect(formatDuration(60000)).toBe('1m 0s')
    expect(formatDuration(90000)).toBe('1m 30s')
    expect(formatDuration(125000)).toBe('2m 5s')
  })

  it('handles large durations', () => {
    expect(formatDuration(3600000)).toBe('60m 0s')
  })
})

describe('formatDate', () => {
  it('formats a Date object', () => {
    // Use midday to avoid timezone day-shift issues
    const date = new Date('2024-01-15T12:00:00Z')
    const result = formatDate(date)
    expect(result).toContain('Jan')
    expect(result).toContain('15')
    expect(result).toContain('2024')
  })

  it('formats a date string', () => {
    const result = formatDate('2024-06-20T12:00:00Z')
    expect(result).toContain('Jun')
    expect(result).toContain('20')
    expect(result).toContain('2024')
  })

  it('formats December date correctly', () => {
    const result = formatDate('2023-12-25T12:00:00Z')
    expect(result).toContain('Dec')
    expect(result).toContain('25')
    expect(result).toContain('2023')
  })
})

describe('formatTime', () => {
  it('formats a Date object to time string', () => {
    const date = new Date('2024-01-15T14:30:45Z')
    const result = formatTime(date)
    // The output depends on timezone but should have HH:MM:SS format
    expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}\s*(AM|PM)?/)
  })

  it('formats a date string to time string', () => {
    const result = formatTime('2024-01-15T08:05:10Z')
    expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}\s*(AM|PM)?/)
  })
})
