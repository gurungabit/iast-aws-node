/**
 * SMB network storage client for accessing corporate file shares.
 *
 * Uses child_process to invoke `smbclient` CLI (available on Linux/macOS).
 * This approach avoids native Node.js SMB packages which are often
 * unmaintained or require complex native compilation.
 *
 * For ROSA/Kubernetes deployments, smbclient is installed in the container image.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)

export interface SmbConfig {
  share: string
  domain: string
  username: string
  password: string
}

export async function readSmbFile(config: SmbConfig, path: string): Promise<Buffer> {
  const tmpPath = join(tmpdir(), `smb-${randomUUID()}.tmp`)

  try {
    // smbclient //server/share -U domain/user%password -c "get remote/path local/path"
    const authStr = config.domain
      ? `${config.domain}/${config.username}%${config.password}`
      : `${config.username}%${config.password}`

    await execFileAsync('smbclient', [config.share, '-U', authStr, '-c', `get "${path}" "${tmpPath}"`], {
      timeout: 60_000,
    })

    return await readFile(tmpPath)
  } catch (err) {
    throw new Error(`Failed to read SMB file ${path}: ${err}`)
  } finally {
    try {
      await unlink(tmpPath)
    } catch {
      // cleanup best-effort
    }
  }
}

export async function writeSmbFile(config: SmbConfig, path: string, data: Buffer): Promise<void> {
  const tmpPath = join(tmpdir(), `smb-${randomUUID()}.tmp`)

  try {
    await writeFile(tmpPath, data)

    const authStr = config.domain
      ? `${config.domain}/${config.username}%${config.password}`
      : `${config.username}%${config.password}`

    await execFileAsync('smbclient', [config.share, '-U', authStr, '-c', `put "${tmpPath}" "${path}"`], {
      timeout: 60_000,
    })
  } catch (err) {
    throw new Error(`Failed to write SMB file ${path}: ${err}`)
  } finally {
    try {
      await unlink(tmpPath)
    } catch {
      // cleanup best-effort
    }
  }
}
