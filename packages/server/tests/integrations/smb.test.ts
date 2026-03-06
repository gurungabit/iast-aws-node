import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    smbConnect: vi.fn(),
    smbReadFile: vi.fn(),
    smbDisconnect: vi.fn(),
  }
})

vi.mock('@src/integrations/smb2/index.js', () => {
  return {
    SMB2Client: class {
      connect = mocks.smbConnect
      readFile = mocks.smbReadFile
      disconnect = mocks.smbDisconnect
    },
  }
})

import { readSmbFile, type SmbConfig } from '@src/integrations/smb.js'

describe('readSmbFile', () => {
  const testConfig: SmbConfig = {
    share: '//server/share',
    domain: 'CORP',
    username: 'user1',
    password: 'pass1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.smbConnect.mockResolvedValue(undefined)
    mocks.smbReadFile.mockResolvedValue(Buffer.from('file content'))
    mocks.smbDisconnect.mockResolvedValue(undefined)
  })

  it('should connect with correct host and share parsed from config', async () => {
    await readSmbFile(testConfig, 'remote/file.txt')

    expect(mocks.smbConnect).toHaveBeenCalledWith({
      host: 'server',
      share: 'share',
      domain: 'CORP',
      username: 'user1',
      password: 'pass1',
    })
  })

  it('should pass undefined domain when domain is empty', async () => {
    const noDomainConfig: SmbConfig = {
      share: '//server/share',
      domain: '',
      username: 'user1',
      password: 'pass1',
    }

    await readSmbFile(noDomainConfig, 'remote/file.txt')

    expect(mocks.smbConnect).toHaveBeenCalledWith({
      host: 'server',
      share: 'share',
      domain: undefined,
      username: 'user1',
      password: 'pass1',
    })
  })

  it('should read the file via SMB2 client and return its content', async () => {
    const content = Buffer.from('hello world')
    mocks.smbReadFile.mockResolvedValue(content)

    const result = await readSmbFile(testConfig, 'file.txt')
    expect(result).toEqual(content)
    expect(mocks.smbReadFile).toHaveBeenCalledWith('file.txt')
  })

  it('should disconnect after successful read', async () => {
    await readSmbFile(testConfig, 'file.txt')
    expect(mocks.smbDisconnect).toHaveBeenCalled()
  })

  it('should disconnect even when connect fails', async () => {
    mocks.smbConnect.mockRejectedValue(new Error('connection refused'))

    await expect(readSmbFile(testConfig, 'file.txt')).rejects.toThrow('Failed to read SMB file')
    expect(mocks.smbDisconnect).toHaveBeenCalled()
  })

  it('should throw descriptive error when read fails', async () => {
    mocks.smbReadFile.mockRejectedValue(new Error('access denied'))

    await expect(readSmbFile(testConfig, 'remote/path.txt')).rejects.toThrow(
      'Failed to read SMB file remote/path.txt',
    )
  })

  it('should throw on invalid share format', async () => {
    const badConfig: SmbConfig = { share: 'invalid', domain: '', username: 'u', password: 'p' }
    await expect(readSmbFile(badConfig, 'file.txt')).rejects.toThrow('Invalid SMB share format')
  })

  it('should handle backslash share format', async () => {
    const bsConfig: SmbConfig = {
      share: '\\\\server\\share',
      domain: '',
      username: 'user1',
      password: 'pass1',
    }

    await readSmbFile(bsConfig, 'file.txt')

    expect(mocks.smbConnect).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'server', share: 'share' }),
    )
  })
})
