import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}))

vi.mock('@src/integrations/ibmdb/index.js', () => ({
  query: mocks.query,
}))

import { getBiRenewPendingRecords } from '@src/integrations/ibmdb/bi-renew-queries.js'
import type { Db2Config } from '@src/integrations/ibmdb/index.js'

const testConfig: Db2Config = {
  database: 'TESTDB',
  hostname: 'db2.example.com',
  port: 446,
  protocol: 'TCPIP',
  uid: 'user',
  pwd: 'pass',
  schema: 'RU99',
}

describe('getBiRenewPendingRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.query.mockResolvedValue([])
  })

  it('should query NZ490 table with correct params', async () => {
    await getBiRenewPendingRecords(testConfig, '03/05/2026')

    expect(mocks.query).toHaveBeenCalledWith(
      testConfig,
      expect.stringContaining('FROM RU99.NZ490'),
      ['03/05/2026'],
    )
  })

  it('should filter by PEND_CODE 21 and PEND_INFO BI_RENEW', async () => {
    await getBiRenewPendingRecords(testConfig, '01/01/2026')

    const sql = mocks.query.mock.calls[0][1] as string
    expect(sql).toContain("PEND_CODE = '21'")
    expect(sql).toContain("PEND_INFO = 'BI_RENEW'")
    expect(sql).toContain('DATE_DELETED IS NULL')
  })

  it('should return records from query', async () => {
    const records = [
      { PEND_KEY: '04X1234567', PEND_INFO: 'BI_RENEW', PEND_DATE: '20260305' },
    ]
    mocks.query.mockResolvedValue(records)

    const result = await getBiRenewPendingRecords(testConfig, '03/05/2026')
    expect(result).toEqual(records)
  })

  it('should propagate query errors', async () => {
    mocks.query.mockRejectedValue(new Error('Connection refused'))

    await expect(getBiRenewPendingRecords(testConfig, '03/05/2026')).rejects.toThrow(
      'Connection refused',
    )
  })
})
