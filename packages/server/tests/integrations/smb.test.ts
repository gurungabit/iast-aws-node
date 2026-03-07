import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
}))

vi.mock('@src/integrations/smb2/client.js', () => ({
  readFile: mocks.readFile,
}))

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
    mocks.readFile.mockResolvedValue(Buffer.from('file content'))
  })

  it('should call readFile with correct host and share parsed from config', async () => {
    await readSmbFile(testConfig, 'remote/file.txt')

    expect(mocks.readFile).toHaveBeenCalledWith(
      { host: 'server', share: 'share', domain: 'CORP', username: 'user1', password: 'pass1' },
      'remote/file.txt',
    )
  })

  it('should pass empty domain when config domain is empty', async () => {
    const noDomainConfig: SmbConfig = {
      share: '//server/share',
      domain: '',
      username: 'user1',
      password: 'pass1',
    }

    await readSmbFile(noDomainConfig, 'remote/file.txt')

    expect(mocks.readFile).toHaveBeenCalledWith(
      expect.objectContaining({ domain: '', username: 'user1' }),
      'remote/file.txt',
    )
  })

  it('should return the buffer from readFile', async () => {
    const content = Buffer.from('hello world')
    mocks.readFile.mockResolvedValue(content)

    const result = await readSmbFile(testConfig, 'file.txt')
    expect(result).toEqual(content)
  })

  it('should wrap errors with descriptive message', async () => {
    mocks.readFile.mockRejectedValue(new Error('access denied'))

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

    expect(mocks.readFile).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'server', share: 'share' }),
      'file.txt',
    )
  })

  it('should strip UNC prefix from path when it matches the share', async () => {
    await readSmbFile(testConfig, '\\\\server\\share\\CORP\\00\\file.txt')

    expect(mocks.readFile).toHaveBeenCalledWith(
      expect.anything(),
      'CORP/00/file.txt',
    )
  })

  it('should strip UNC prefix case-insensitively', async () => {
    const config: SmbConfig = {
      share: '\\\\Opr.statefarm.org\\dfs',
      domain: 'CORP',
      username: 'user1',
      password: 'pass1',
    }

    await readSmbFile(config, '\\\\Opr.statefarm.org\\dfs\\CORP\\00\\WORKGROUP\\FTP\\file.txt')

    expect(mocks.readFile).toHaveBeenCalledWith(
      expect.anything(),
      'CORP/00/WORKGROUP/FTP/file.txt',
    )
  })

  it('should use path as-is when it does not match share prefix', async () => {
    await readSmbFile(testConfig, 'relative/path/file.txt')

    expect(mocks.readFile).toHaveBeenCalledWith(
      expect.anything(),
      'relative/path/file.txt',
    )
  })

  it('should split DOMAIN\\username and pass domain as-is', async () => {
    const config: SmbConfig = {
      share: '\\\\server.example.com\\share',
      domain: 'LONG.EXAMPLE.COM',
      username: 'CORP\\jdoe',
      password: 'pass1',
    }

    await readSmbFile(config, 'file.txt')

    expect(mocks.readFile).toHaveBeenCalledWith(
      {
        host: 'server.example.com',
        share: 'share',
        domain: 'LONG.EXAMPLE.COM',
        username: 'jdoe',
        password: 'pass1',
      },
      'file.txt',
    )
  })

  it('should use domain from username prefix when config domain is empty', async () => {
    const config: SmbConfig = {
      share: '//server/share',
      domain: '',
      username: 'MYDOMAIN\\user1',
      password: 'pass1',
    }

    await readSmbFile(config, 'file.txt')

    expect(mocks.readFile).toHaveBeenCalledWith(
      {
        host: 'server',
        share: 'share',
        domain: 'MYDOMAIN',
        username: 'user1',
        password: 'pass1',
      },
      'file.txt',
    )
  })
})
