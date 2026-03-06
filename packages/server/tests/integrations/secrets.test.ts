import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const send = vi.fn()
  return {
    send,
    SecretsManagerClient: vi.fn().mockImplementation(function () {
      return { send }
    }),
    GetSecretValueCommand: vi.fn().mockImplementation(function (this: Record<string, unknown>, input: Record<string, unknown>) {
      this.__type = 'GetSecretValueCommand'
      this.input = input
    }),
    PutSecretValueCommand: vi.fn().mockImplementation(function (this: Record<string, unknown>, input: Record<string, unknown>) {
      this.__type = 'PutSecretValueCommand'
      this.input = input
    }),
  }
})

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: mocks.SecretsManagerClient,
  GetSecretValueCommand: mocks.GetSecretValueCommand,
  PutSecretValueCommand: mocks.PutSecretValueCommand,
}))

import { getSecret, putSecret } from '@src/integrations/secrets.js'

describe('getSecret', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call GetSecretValueCommand with the correct SecretId', async () => {
    mocks.send.mockResolvedValue({ SecretString: 'my-secret-value' })

    await getSecret('my/secret/id')

    expect(mocks.GetSecretValueCommand).toHaveBeenCalledWith({
      SecretId: 'my/secret/id',
    })
  })

  it('should return the SecretString from the response', async () => {
    mocks.send.mockResolvedValue({ SecretString: '{"user":"admin","pass":"1234"}' })

    const result = await getSecret('db-creds')
    expect(result).toBe('{"user":"admin","pass":"1234"}')
  })

  it('should throw when SecretString is undefined', async () => {
    mocks.send.mockResolvedValue({ SecretString: undefined })

    await expect(getSecret('binary-secret')).rejects.toThrow(
      'Secret binary-secret has no string value',
    )
  })

  it('should throw when SecretString is null', async () => {
    mocks.send.mockResolvedValue({ SecretString: null })

    await expect(getSecret('null-secret')).rejects.toThrow(
      'Secret null-secret has no string value',
    )
  })

  it('should propagate errors from client.send', async () => {
    mocks.send.mockRejectedValue(new Error('ResourceNotFoundException'))

    await expect(getSecret('nonexistent')).rejects.toThrow('ResourceNotFoundException')
  })

  it('should send the command via the SecretsManagerClient', async () => {
    mocks.send.mockResolvedValue({ SecretString: 'val' })

    await getSecret('test-id')
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  it('should throw when SecretString is empty string', async () => {
    mocks.send.mockResolvedValue({ SecretString: '' })

    // Empty string is falsy, so it should throw
    await expect(getSecret('empty-secret')).rejects.toThrow(
      'Secret empty-secret has no string value',
    )
  })
})

describe('putSecret', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call PutSecretValueCommand with correct SecretId and SecretString', async () => {
    mocks.send.mockResolvedValue({})

    await putSecret('my/secret/id', 'new-value')

    expect(mocks.PutSecretValueCommand).toHaveBeenCalledWith({
      SecretId: 'my/secret/id',
      SecretString: 'new-value',
    })
  })

  it('should send the put command via the client', async () => {
    mocks.send.mockResolvedValue({})

    await putSecret('secret-id', 'value')
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  it('should resolve without returning a value', async () => {
    mocks.send.mockResolvedValue({})

    const result = await putSecret('id', 'val')
    expect(result).toBeUndefined()
  })

  it('should propagate errors from client.send', async () => {
    mocks.send.mockRejectedValue(new Error('AccessDeniedException'))

    await expect(putSecret('restricted', 'val')).rejects.toThrow('AccessDeniedException')
  })

  it('should handle JSON string values', async () => {
    mocks.send.mockResolvedValue({})

    const jsonValue = JSON.stringify({ user: 'admin', pass: 'secret' })
    await putSecret('json-secret', jsonValue)

    expect(mocks.PutSecretValueCommand).toHaveBeenCalledWith({
      SecretId: 'json-secret',
      SecretString: jsonValue,
    })
  })
})
