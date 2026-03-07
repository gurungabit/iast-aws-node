/**
 * SMB file access for 412 files.
 * Uses @awo00/smb2 library for NTLM-authenticated SMB2 connections.
 */

import { Client } from '@awo00/smb2'

export interface SmbConfig {
  share: string
  domain: string
  username: string
  password: string
}

/**
 * Read a file from an SMB share.
 */
export async function readSmbFile(config: SmbConfig, path: string): Promise<Buffer> {
  // Parse share: //server/sharename or \\server\sharename
  const normalized = config.share.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length < 2) {
    throw new Error(`Invalid SMB share format: ${config.share} (expected //server/share)`)
  }
  const host = parts[0]
  const shareName = parts[1]

  // Strip the \\server\share prefix from the path if present (UNC → share-relative)
  const normalizedPath = path.replace(/\\/g, '/')
  const sharePrefix = `//${host}/${shareName}/`
  const relativePath = normalizedPath.toLowerCase().startsWith(sharePrefix.toLowerCase())
    ? normalizedPath.slice(sharePrefix.length)
    : normalizedPath.replace(/^\/+/, '')

  // Handle DOMAIN\username format
  let username = config.username
  let domain = config.domain || ''
  if (username.includes('\\')) {
    const parts2 = username.split('\\')
    domain = domain || parts2[0]
    username = parts2[1]
  }

  console.log(`[SMB] host=${host}, share=${shareName}, relative="${relativePath}", user=${username}, domain=${domain}`)

  const client = new Client(host, { requestTimeout: 30_000 })
  try {
    await client.connect()
    const session = await client.authenticate({ domain, username, password: config.password })
    const tree = await session.connectTree(shareName)
    const buffer = await tree.readFile('/' + relativePath)
    await client.close()
    return buffer
  } catch (err) {
    try { await client.close() } catch { /* best effort */ }
    throw new Error(`Failed to read SMB file ${path}: ${err}`)
  }
}
