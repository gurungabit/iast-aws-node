/**
 * DB2 client for BI Renew AST.
 *
 * Uses the `ibm_db` package for native DB2 connectivity.
 * Install: npm install ibm_db
 *
 * Requires IBM DB2 CLI/ODBC driver or Db2 Data Server Client.
 * Falls back gracefully if ibm_db is not installed.
 */

export interface Db2Config {
  hostname: string
  port: number
  database: string
  username: string
  password: string
}

export async function queryDb2(config: Db2Config, sql: string, params: unknown[] = []): Promise<unknown[]> {
  // Dynamic import with error handling for optional dependency
  let ibmdb: { open: (connStr: string) => Promise<{ query: (sql: string, params: unknown[]) => Promise<unknown[]>; close: () => Promise<void> }> }
  try {
    ibmdb = await (Function('return import("ibm_db")')() as Promise<typeof ibmdb>)
  } catch {
    throw new Error(
      'DB2 integration requires the ibm_db package. Install it with: npm install ibm_db',
    )
  }

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
    return results as unknown[]
  } finally {
    await conn.close()
  }
}
