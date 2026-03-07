/**
 * DB2 queries specific to BI Renew AST.
 */

import { query, type Db2Config } from './index.js'

interface BiRenewPendingRecord {
  PEND_KEY: string
  PEND_INFO: string
  PEND_DATE: string
}

export async function getBiRenewPendingRecords(
  config: Db2Config,
  dateProcessed: string,
): Promise<BiRenewPendingRecord[]> {
  return query<BiRenewPendingRecord>(
    config,
    `SELECT PEND_KEY, PEND_INFO, PEND_DATE
     FROM RU99.NZ490
     WHERE PART_KEY = '0'
       AND DATE_PROCESSED = ?
       AND PEND_CODE = '21'
       AND PEND_INFO = 'BI_RENEW'
       AND DATE_DELETED IS NULL
     WITH UR`,
    [dateProcessed],
  )
}
