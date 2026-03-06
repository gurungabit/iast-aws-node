import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRunLoginAST, mockRunBiRenewAST, mockRunRoutExtractorAST } = vi.hoisted(() => ({
  mockRunLoginAST: vi.fn(),
  mockRunBiRenewAST: vi.fn(),
  mockRunRoutExtractorAST: vi.fn(),
}))

vi.mock('./login.js', () => ({
  runLoginAST: mockRunLoginAST,
}))

vi.mock('./bi-renew.js', () => ({
  runBiRenewAST: mockRunBiRenewAST,
}))

vi.mock('./rout-extractor.js', () => ({
  runRoutExtractorAST: mockRunRoutExtractorAST,
}))

vi.mock('tnz3270-node', () => ({ Ati: class {} }))

import { executeAST } from './executor.js'
import { Ati } from 'tnz3270-node'
import type { ProgressReporter } from './progress.js'
import type { ASTContext } from './executor.js'

describe('executeAST', () => {
  const mockAti = new Ati()
  const mockReporter = {} as ProgressReporter
  const mockCtx: ASTContext = { checkpoint: vi.fn() }
  const params = { foo: 'bar' }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dispatches to runLoginAST for "login" astName', async () => {
    mockRunLoginAST.mockResolvedValue('login-result')
    const result = await executeAST(mockAti, 'login', params, mockReporter, mockCtx)

    expect(mockRunLoginAST).toHaveBeenCalledOnce()
    expect(mockRunLoginAST).toHaveBeenCalledWith(mockAti, params, mockReporter, mockCtx)
    expect(result).toBe('login-result')
  })

  it('dispatches to runBiRenewAST for "bi-renew" astName', async () => {
    mockRunBiRenewAST.mockResolvedValue('bi-renew-result')
    const result = await executeAST(mockAti, 'bi-renew', params, mockReporter, mockCtx)

    expect(mockRunBiRenewAST).toHaveBeenCalledOnce()
    expect(mockRunBiRenewAST).toHaveBeenCalledWith(mockAti, params, mockReporter, mockCtx)
    expect(result).toBe('bi-renew-result')
  })

  it('dispatches to runRoutExtractorAST for "rout-extractor" astName', async () => {
    mockRunRoutExtractorAST.mockResolvedValue('rout-result')
    const result = await executeAST(mockAti, 'rout-extractor', params, mockReporter, mockCtx)

    expect(mockRunRoutExtractorAST).toHaveBeenCalledOnce()
    expect(mockRunRoutExtractorAST).toHaveBeenCalledWith(mockAti, params, mockReporter, mockCtx)
    expect(result).toBe('rout-result')
  })

  it('throws Error for unknown AST name', async () => {
    await expect(
      // @ts-expect-error testing unknown AST name
      executeAST(mockAti, 'unknown-ast', params, mockReporter, mockCtx),
    ).rejects.toThrow('Unknown AST: unknown-ast')
  })

  it('throws for empty string AST name', async () => {
    await expect(
      // @ts-expect-error testing empty string as AST name
      executeAST(mockAti, '', params, mockReporter, mockCtx),
    ).rejects.toThrow('Unknown AST: ')
  })

  it('propagates errors thrown by the dispatched AST', async () => {
    mockRunLoginAST.mockRejectedValue(new Error('login failed'))
    await expect(
      executeAST(mockAti, 'login', params, mockReporter, mockCtx),
    ).rejects.toThrow('login failed')
  })

  it('passes the exact params object reference to the AST function', async () => {
    mockRunLoginAST.mockResolvedValue(undefined)
    const specificParams = { key: 'value', nested: { a: 1 } }
    await executeAST(mockAti, 'login', specificParams, mockReporter, mockCtx)
    expect(mockRunLoginAST.mock.calls[0][1]).toBe(specificParams)
  })
})
