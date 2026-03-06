import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    execFile: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn(),
    tmpdir: vi.fn(() => '/tmp'),
    randomUUID: vi.fn(() => 'test-uuid-1234'),
  }
})

vi.mock('child_process', () => ({
  execFile: mocks.execFile,
}))

vi.mock('util', () => ({
  promisify: (fn: (...args: unknown[]) => unknown) => fn,
}))

vi.mock('fs/promises', () => ({
  writeFile: mocks.writeFile,
  readFile: mocks.readFile,
  unlink: mocks.unlink,
}))

vi.mock('os', () => ({
  tmpdir: mocks.tmpdir,
}))

vi.mock('crypto', () => ({
  randomUUID: mocks.randomUUID,
}))

import { readSmbFile, writeSmbFile, type SmbConfig } from './smb.js'

describe('readSmbFile', () => {
  const testConfig: SmbConfig = {
    share: '//server/share',
    domain: 'CORP',
    username: 'user1',
    password: 'pass1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.execFile.mockResolvedValue({ stdout: '', stderr: '' })
    mocks.readFile.mockResolvedValue(Buffer.from('file content'))
    mocks.unlink.mockResolvedValue(undefined)
  })

  it('should call smbclient with correct args including domain', async () => {
    await readSmbFile(testConfig, 'remote/file.txt')

    expect(mocks.execFile).toHaveBeenCalledWith(
      'smbclient',
      [
        '//server/share',
        '-U',
        'CORP/user1%pass1',
        '-c',
        'get "remote/file.txt" "/tmp/smb-test-uuid-1234.tmp"',
      ],
      { timeout: 60_000 },
    )
  })

  it('should call smbclient without domain prefix when domain is empty', async () => {
    const noDomainConfig: SmbConfig = {
      share: '//server/share',
      domain: '',
      username: 'user1',
      password: 'pass1',
    }

    await readSmbFile(noDomainConfig, 'remote/file.txt')

    expect(mocks.execFile).toHaveBeenCalledWith(
      'smbclient',
      [
        '//server/share',
        '-U',
        'user1%pass1',
        '-c',
        'get "remote/file.txt" "/tmp/smb-test-uuid-1234.tmp"',
      ],
      { timeout: 60_000 },
    )
  })

  it('should read the temp file and return its content as Buffer', async () => {
    const content = Buffer.from('hello world')
    mocks.readFile.mockResolvedValue(content)

    const result = await readSmbFile(testConfig, 'file.txt')
    expect(result).toEqual(content)
    expect(mocks.readFile).toHaveBeenCalledWith('/tmp/smb-test-uuid-1234.tmp')
  })

  it('should clean up temp file after successful read', async () => {
    await readSmbFile(testConfig, 'file.txt')
    expect(mocks.unlink).toHaveBeenCalledWith('/tmp/smb-test-uuid-1234.tmp')
  })

  it('should clean up temp file even when smbclient fails', async () => {
    mocks.execFile.mockRejectedValue(new Error('smbclient failed'))

    await expect(readSmbFile(testConfig, 'file.txt')).rejects.toThrow('Failed to read SMB file')
    expect(mocks.unlink).toHaveBeenCalledWith('/tmp/smb-test-uuid-1234.tmp')
  })

  it('should throw descriptive error when smbclient fails', async () => {
    mocks.execFile.mockRejectedValue(new Error('connection refused'))

    await expect(readSmbFile(testConfig, 'remote/path.txt')).rejects.toThrow(
      'Failed to read SMB file remote/path.txt',
    )
  })

  it('should not throw when unlink fails during cleanup', async () => {
    mocks.unlink.mockRejectedValue(new Error('unlink failed'))
    mocks.readFile.mockResolvedValue(Buffer.from('data'))

    // Should not throw despite unlink failure
    const result = await readSmbFile(testConfig, 'file.txt')
    expect(result).toEqual(Buffer.from('data'))
  })
})

describe('writeSmbFile', () => {
  const testConfig: SmbConfig = {
    share: '//server/share',
    domain: 'CORP',
    username: 'writer',
    password: 'wpass',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.execFile.mockResolvedValue({ stdout: '', stderr: '' })
    mocks.unlink.mockResolvedValue(undefined)
  })

  it('should write data to temp file before uploading', async () => {
    const data = Buffer.from('output data')
    await writeSmbFile(testConfig, 'remote/output.txt', data)

    expect(mocks.writeFile).toHaveBeenCalledWith('/tmp/smb-test-uuid-1234.tmp', data)
  })

  it('should call smbclient with put command and correct args', async () => {
    await writeSmbFile(testConfig, 'remote/output.txt', Buffer.from('data'))

    expect(mocks.execFile).toHaveBeenCalledWith(
      'smbclient',
      [
        '//server/share',
        '-U',
        'CORP/writer%wpass',
        '-c',
        'put "/tmp/smb-test-uuid-1234.tmp" "remote/output.txt"',
      ],
      { timeout: 60_000 },
    )
  })

  it('should call smbclient without domain when domain is empty', async () => {
    const noDomainConfig: SmbConfig = {
      share: '//server/share',
      domain: '',
      username: 'writer',
      password: 'wpass',
    }

    await writeSmbFile(noDomainConfig, 'remote/output.txt', Buffer.from('data'))

    expect(mocks.execFile).toHaveBeenCalledWith(
      'smbclient',
      [
        '//server/share',
        '-U',
        'writer%wpass',
        '-c',
        'put "/tmp/smb-test-uuid-1234.tmp" "remote/output.txt"',
      ],
      { timeout: 60_000 },
    )
  })

  it('should clean up temp file after successful write', async () => {
    await writeSmbFile(testConfig, 'file.txt', Buffer.from('data'))
    expect(mocks.unlink).toHaveBeenCalledWith('/tmp/smb-test-uuid-1234.tmp')
  })

  it('should clean up temp file even when smbclient fails', async () => {
    mocks.execFile.mockRejectedValue(new Error('upload failed'))

    await expect(writeSmbFile(testConfig, 'file.txt', Buffer.from('data'))).rejects.toThrow(
      'Failed to write SMB file',
    )
    expect(mocks.unlink).toHaveBeenCalledWith('/tmp/smb-test-uuid-1234.tmp')
  })

  it('should throw descriptive error when write fails', async () => {
    mocks.execFile.mockRejectedValue(new Error('permission denied'))

    await expect(writeSmbFile(testConfig, 'remote/out.txt', Buffer.from('d'))).rejects.toThrow(
      'Failed to write SMB file remote/out.txt',
    )
  })

  it('should not throw when unlink fails during cleanup after success', async () => {
    mocks.unlink.mockRejectedValue(new Error('unlink error'))

    // Should complete without throwing
    await expect(writeSmbFile(testConfig, 'file.txt', Buffer.from('data'))).resolves.toBeUndefined()
  })
})
