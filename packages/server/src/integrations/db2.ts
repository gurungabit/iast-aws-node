/**
 * DB2 client for BI Renew AST.
 *
 * Uses the `ibm_db` package for native DB2 connectivity.
 * Requires IBM DB2 CLI/ODBC driver or Db2 Data Server Client.
 */

import ibmdb, { type SQLParam } from 'ibm_db'

export interface Db2Config {
  hostname: string
  port: number
  database: string
  username: string
  password: string
}

export async function queryDb2(config: Db2Config, sql: string, params: SQLParam[] = []): Promise<Record<string, unknown>[]> {
  const connStr =
    `DATABASE=${config.database};` +
    `HOSTNAME=${config.hostname};` +
    `PORT=${config.port};` +
    `PROTOCOL=TCPIP;` +
    `UID=${config.username};` +
    `PWD=${config.password};`

  const conn = await ibmdb.open(connStr)

  try {
    const results = await conn.query(sql, params)
    return results as Record<string, unknown>[]
  } finally {
    await conn.close()
  }
}
