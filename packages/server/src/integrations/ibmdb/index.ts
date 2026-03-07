/**
 * Reusable DB2 connection module using ibm_db.
 *
 * Provides connect/disconnect/query utilities that any AST or service
 * can import. Add new query functions in separate files within this
 * directory (e.g., bi-renew-queries.ts).
 */

import ibmdb from 'ibm_db'

export interface Db2Config {
  database: string
  hostname: string
  port: number
  protocol: string
  uid: string
  pwd: string
  schema: string
  sslCertPath?: string
}

export interface Db2Connection {
  conn: ibmdb.Database
  connStr: string
}

function buildConnectionString(config: Db2Config): string {
  let connStr =
    `DATABASE=${config.database};` +
    `HOSTNAME=${config.hostname};` +
    `PORT=${config.port};` +
    `PROTOCOL=${config.protocol};` +
    `UID=${config.uid};` +
    `PWD=${config.pwd};` +
    `CurrentSchema=${config.schema};`

  if (config.sslCertPath) {
    connStr += `SECURITY=SSL;SSLServerCertificate=${config.sslCertPath};`
  }

  return connStr
}

export async function connect(config: Db2Config): Promise<Db2Connection> {
  const connStr = buildConnectionString(config)
  const conn = await ibmdb.open(connStr)
  return { conn, connStr }
}

export async function disconnect(connection: Db2Connection): Promise<void> {
  try {
    await connection.conn.close()
  } catch {
    // ignore close errors
  }
}

export async function query<T = Record<string, unknown>>(
  config: Db2Config,
  sql: string,
  params: (string | number | null)[] = [],
): Promise<T[]> {
  const { conn } = await connect(config)
  try {
    const results = await conn.query(sql, params)
    return results as T[]
  } finally {
    try {
      await conn.close()
    } catch {
      // ignore
    }
  }
}
