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

import { query, connect, disconnect, type Db2Config } from '@src/integrations/ibmdb/index.js'

const testConfig: Db2Config = {
  database: 'TESTDB',
  hostname: 'db2.example.com',
  port: 50000,
  protocol: 'TCPIP',
  uid: 'admin',
  pwd: 'secret123',
  schema: 'RU99',
}

describe('ibmdb', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ibmdb.open.mockResolvedValue(mocks.mockConn)
    mocks.mockConn.query.mockResolvedValue([])
    mocks.mockConn.close.mockResolvedValue(undefined)
  })

  describe('connect', () => {
    it('should build connection string with all config fields and SSL cert', async () => {
      await connect(testConfig)

      const connStr = mocks.ibmdb.open.mock.calls[0][0] as string
      expect(connStr).toContain('DATABASE=TESTDB;')
      expect(connStr).toContain('HOSTNAME=db2.example.com;')
      expect(connStr).toContain('PORT=50000;')
      expect(connStr).toContain('PROTOCOL=TCPIP;')
      expect(connStr).toContain('UID=admin;')
      expect(connStr).toContain('PWD=secret123;')
      expect(connStr).toContain('CurrentSchema=RU99;')
      expect(connStr).toContain('SECURITY=SSL;')
      expect(connStr).toMatch(/SSLServerCertificate=.*cacerts\.crt;/)
    })
  })

  describe('disconnect', () => {
    it('should close the connection', async () => {
      const connection = await connect(testConfig)
      await disconnect(connection)

      expect(mocks.mockConn.close).toHaveBeenCalledTimes(1)
    })

    it('should not throw when close fails', async () => {
      mocks.mockConn.close.mockRejectedValue(new Error('already closed'))
      const connection = await connect(testConfig)

      await expect(disconnect(connection)).resolves.toBeUndefined()
    })
  })

  describe('query', () => {
    it('should execute query with default empty params', async () => {
      await query(testConfig, 'SELECT 1')

      expect(mocks.mockConn.query).toHaveBeenCalledWith('SELECT 1', [])
    })

    it('should execute query with provided params', async () => {
      await query(testConfig, 'SELECT * FROM T WHERE ID = ?', ['123'])

      expect(mocks.mockConn.query).toHaveBeenCalledWith('SELECT * FROM T WHERE ID = ?', ['123'])
    })

    it('should return query results', async () => {
      const mockResults = [{ ID: 1, NAME: 'Alice' }]
      mocks.mockConn.query.mockResolvedValue(mockResults)

      const result = await query(testConfig, 'SELECT * FROM USERS')
      expect(result).toEqual(mockResults)
    })

    it('should close connection after successful query', async () => {
      await query(testConfig, 'SELECT 1')

      expect(mocks.mockConn.close).toHaveBeenCalledTimes(1)
    })

    it('should close connection even when query throws', async () => {
      mocks.mockConn.query.mockRejectedValue(new Error('SQL error'))

      await expect(query(testConfig, 'BAD SQL')).rejects.toThrow('SQL error')
      expect(mocks.mockConn.close).toHaveBeenCalledTimes(1)
    })

    it('should re-throw errors from open', async () => {
      mocks.ibmdb.open.mockRejectedValue(new Error('Cannot connect'))

      await expect(query(testConfig, 'SELECT 1')).rejects.toThrow('Cannot connect')
    })
  })
})
