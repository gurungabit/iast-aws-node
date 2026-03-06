/**
 * SMB file access for 412 files.
 * Pure-JS SMB2 client — connects directly to SMB share over the network.
 * Works cross-platform without any CLI dependency.
 */

import { SMB2Client } from './smb2/index.js'

export interface SmbConfig {
  share: string
  domain: string
  username: string
  password: string
}

/**
 * Read a file from an SMB share using the built-in SMB2 client.
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

  // Handle DOMAIN\username format — split into separate domain and username
  let username = config.username
  let domain = config.domain || ''
  if (username.includes('\\')) {
    const parts2 = username.split('\\')
    domain = domain || parts2[0]
    username = parts2[1]
  }
  // NTLM uses NetBIOS (short) domain name, not FQDN
  if (domain.includes('.')) {
    domain = domain.split('.')[0]
  }

  console.log(`[SMB] host=${host}, share=${shareName}, relative="${relativePath}", user=${username}, domain=${domain}`)

  const client = new SMB2Client()
  try {
    await client.connect({
      host,
      share: shareName,
      domain: domain || undefined,
      username,
      password: config.password,
    })
    return await client.readFile(relativePath)
  } catch (err) {
    throw new Error(`Failed to read SMB file ${path}: ${err}`)
  } finally {
    await client.disconnect()
  }
}
