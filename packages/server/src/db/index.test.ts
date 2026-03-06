import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const mockSql = vi.fn()
  // Tagged template support: postgres returns a function that also works as a tagged template
  const mockPostgres = vi.fn(() => mockSql)
  const mockDrizzle = vi.fn(() => ({ __brand: 'drizzle-db' }))

  return {
    mockSql,
    mockPostgres,
    mockDrizzle,
    config: {
      databaseUrl: 'postgres://test:test@localhost:5432/testdb',
    },
  }
})

vi.mock('postgres', () => ({
  default: mocks.mockPostgres,
}))

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: mocks.mockDrizzle,
}))

vi.mock('../config.js', () => ({
  config: mocks.config,
}))

vi.mock('./schema/index.js', () => ({
  users: {},
  sessions: {},
}))

import { db, checkDbConnection } from './index.js'

describe('db export', () => {
  it('should export a db object', () => {
    expect(db).toBeDefined()
  })

  it('should create postgres client with databaseUrl from config', () => {
    expect(mocks.mockPostgres).toHaveBeenCalledWith('postgres://test:test@localhost:5432/testdb')
  })

  it('should create drizzle instance with the postgres client and schema', () => {
    expect(mocks.mockDrizzle).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ schema: expect.any(Object) }),
    )
  })
})

describe('checkDbConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return true when SELECT 1 succeeds', async () => {
    // The tagged template call: queryClient`SELECT 1` invokes mockSql as a tagged template
    mocks.mockSql.mockResolvedValue([{ '?column?': 1 }])

    const result = await checkDbConnection()
    expect(result).toBe(true)
  })

  it('should return false when SELECT 1 throws', async () => {
    mocks.mockSql.mockRejectedValue(new Error('Connection refused'))

    const result = await checkDbConnection()
    expect(result).toBe(false)
  })

  it('should return false on timeout error', async () => {
    mocks.mockSql.mockRejectedValue(new Error('Connection timed out'))

    const result = await checkDbConnection()
    expect(result).toBe(false)
  })

  it('should return false on authentication error', async () => {
    mocks.mockSql.mockRejectedValue(new Error('password authentication failed'))

    const result = await checkDbConnection()
    expect(result).toBe(false)
  })

  it('should call the sql tagged template function', async () => {
    mocks.mockSql.mockResolvedValue([])

    await checkDbConnection()
    expect(mocks.mockSql).toHaveBeenCalled()
  })

  it('should return true even when query returns empty result', async () => {
    mocks.mockSql.mockResolvedValue([])

    const result = await checkDbConnection()
    expect(result).toBe(true)
  })
})
