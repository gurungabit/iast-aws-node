import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const mockConn = {
    query: vi.fn(),
    close: vi.fn(),
  }
  return {
    mockConn,
    ibmdb: {
      open: vi.fn(),
    },
  }
})

vi.mock('ibm_db', () => ({
  default: mocks.ibmdb,
}))

import { queryDb2, type Db2Config } from './db2.js'

describe('queryDb2', () => {
  const testConfig: Db2Config = {
    hostname: 'db2.example.com',
    port: 50000,
    database: 'TESTDB',
    username: 'admin',
    password: 'secret123',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ibmdb.open.mockResolvedValue(mocks.mockConn)
    mocks.mockConn.query.mockResolvedValue([])
    mocks.mockConn.close.mockResolvedValue(undefined)
  })

  it('should build the correct connection string', async () => {
    await queryDb2(testConfig, 'SELECT 1')

    const expectedConnStr =
      'DATABASE=TESTDB;HOSTNAME=db2.example.com;PORT=50000;PROTOCOL=TCPIP;UID=admin;PWD=secret123;'
    expect(mocks.ibmdb.open).toHaveBeenCalledWith(expectedConnStr)
  })

  it('should call conn.query with sql and empty params by default', async () => {
    await queryDb2(testConfig, 'SELECT * FROM USERS')

    expect(mocks.mockConn.query).toHaveBeenCalledWith('SELECT * FROM USERS', [])
  })

  it('should call conn.query with sql and provided params', async () => {
    const params = ['param1', 42]
    await queryDb2(testConfig, 'SELECT * FROM USERS WHERE ID = ?', params as (string | number)[])

    expect(mocks.mockConn.query).toHaveBeenCalledWith('SELECT * FROM USERS WHERE ID = ?', params)
  })

  it('should return query results', async () => {
    const mockResults = [{ ID: 1, NAME: 'Alice' }, { ID: 2, NAME: 'Bob' }]
    mocks.mockConn.query.mockResolvedValue(mockResults)

    const result = await queryDb2(testConfig, 'SELECT * FROM USERS')
    expect(result).toEqual(mockResults)
  })

  it('should close the connection after successful query', async () => {
    await queryDb2(testConfig, 'SELECT 1')

    expect(mocks.mockConn.close).toHaveBeenCalledTimes(1)
  })

  it('should close the connection even when query throws', async () => {
    mocks.mockConn.query.mockRejectedValue(new Error('SQL error'))

    await expect(queryDb2(testConfig, 'BAD SQL')).rejects.toThrow('SQL error')
    expect(mocks.mockConn.close).toHaveBeenCalledTimes(1)
  })

  it('should re-throw errors from query', async () => {
    const error = new Error('Connection timeout')
    mocks.mockConn.query.mockRejectedValue(error)

    await expect(queryDb2(testConfig, 'SELECT 1')).rejects.toThrow('Connection timeout')
  })

  it('should re-throw errors from open', async () => {
    mocks.ibmdb.open.mockRejectedValue(new Error('Cannot connect'))

    await expect(queryDb2(testConfig, 'SELECT 1')).rejects.toThrow('Cannot connect')
  })

  it('should handle different config values correctly', async () => {
    const altConfig: Db2Config = {
      hostname: '192.168.1.100',
      port: 60000,
      database: 'PRODDB',
      username: 'root',
      password: 'p@$$w0rd',
    }

    await queryDb2(altConfig, 'SELECT 1')

    const expectedConnStr =
      'DATABASE=PRODDB;HOSTNAME=192.168.1.100;PORT=60000;PROTOCOL=TCPIP;UID=root;PWD=p@$$w0rd;'
    expect(mocks.ibmdb.open).toHaveBeenCalledWith(expectedConnStr)
  })

  it('should return empty array when query returns empty result', async () => {
    mocks.mockConn.query.mockResolvedValue([])

    const result = await queryDb2(testConfig, 'SELECT * FROM EMPTY_TABLE')
    expect(result).toEqual([])
  })
})
