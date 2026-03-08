import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ASTContext } from '@src/ast/executor.js'

vi.mock('tnz3270-node', () => ({ Ati: class {} }))
vi.mock('worker_threads', () => ({ MessagePort: class {} }))
vi.mock('@src/ast/progress.js', () => ({
  ProgressReporter: class {
    reportProgress = vi.fn()
    addItem = vi.fn()
    reportStatus = vi.fn()
    reportComplete = vi.fn()
    flush = vi.fn()
    dispose = vi.fn()
  },
}))

import { Ati } from 'tnz3270-node'
import { MessagePort } from 'worker_threads'
import { ProgressReporter } from '@src/ast/progress.js'

const mockSession = vi.hoisted(() => ({
  authenticate: vi.fn().mockResolvedValue({ success: true, error: '' }),
  waitForKeyboard: vi.fn().mockResolvedValue(true),
  logoff: vi.fn().mockResolvedValue({ success: true, error: '' }),
}))

vi.mock('@src/ast/session.js', () => ({
  Session: function () {
    return mockSession
  },
}))

vi.mock('crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('test-uuid'),
}))

import { runLoginAST } from '@src/ast/login/index.js'

describe('runLoginAST', () => {
  let mockAti: Ati
  let mockReporter: ProgressReporter
  let mockCtx: ASTContext

  beforeEach(() => {
    vi.clearAllMocks()

    mockAti = new Ati()

    mockReporter = new ProgressReporter('test', new MessagePort())

    mockCtx = {
      checkpoint: vi.fn().mockResolvedValue(undefined),
      completedPolicies: new Set(),
    }
  })

  it('throws when username is missing', async () => {
    await expect(
      runLoginAST(mockAti, { password: 'pass' }, mockReporter, mockCtx),
    ).rejects.toThrow('Username and password are required')
  })

  it('throws when password is missing', async () => {
    await expect(
      runLoginAST(mockAti, { username: 'user' }, mockReporter, mockCtx),
    ).rejects.toThrow('Username and password are required')
  })

  it('throws when authentication fails', async () => {
    mockSession.authenticate.mockResolvedValueOnce({ success: false, error: 'Bad creds' })
    await expect(
      runLoginAST(
        mockAti,
        { username: 'user', password: 'pass', policyNumbers: [] },
        mockReporter,
        mockCtx,
      ),
    ).rejects.toThrow('Login failed: Bad creds')
  })

  it('authenticates then processes valid policies', async () => {
    const params = {
      username: 'user',
      password: 'pass',
      policyNumbers: ['ABC123456'],
    }

    await runLoginAST(mockAti, params, mockReporter, mockCtx)

    expect(mockSession.authenticate).toHaveBeenCalledWith({
      username: 'user',
      password: 'pass',
      expectedKeywords: ['Fire System Selection'],
      application: 'FIRE06',
      group: '@OOFIRE',
    })

    expect(mockReporter.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        policyNumber: 'ABC123456',
        status: 'success',
      }),
    )
  })

  it('skips invalid policy numbers - too short', async () => {
    const params = {
      username: 'user',
      password: 'pass',
      policyNumbers: ['ABC'],
    }

    await runLoginAST(mockAti, params, mockReporter, mockCtx)

    expect(mockReporter.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        policyNumber: 'ABC',
        status: 'skipped',
        error: 'Invalid policy number format',
      }),
    )
  })

  it('skips invalid policy numbers - non-alphanumeric', async () => {
    const params = {
      username: 'user',
      password: 'pass',
      policyNumbers: ['ABC-12345'],
    }

    await runLoginAST(mockAti, params, mockReporter, mockCtx)

    expect(mockReporter.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        policyNumber: 'ABC-12345',
        status: 'skipped',
      }),
    )
  })

  it('reports progress for each policy', async () => {
    const params = {
      username: 'user',
      password: 'pass',
      policyNumbers: ['ABC123456', 'DEF789012'],
    }

    await runLoginAST(mockAti, params, mockReporter, mockCtx)

    expect(mockReporter.reportProgress).toHaveBeenCalledWith(
      1,
      2,
      'Processing ABC123456',
    )
    expect(mockReporter.reportProgress).toHaveBeenCalledWith(
      2,
      2,
      'Processing DEF789012',
    )
  })

  it('handles errors during policy processing', async () => {
    mockSession.waitForKeyboard.mockRejectedValueOnce(new Error('Connection lost'))

    const params = {
      username: 'user',
      password: 'pass',
      policyNumbers: ['ABC123456'],
    }

    await runLoginAST(mockAti, params, mockReporter, mockCtx)

    expect(mockReporter.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        policyNumber: 'ABC123456',
        status: 'error',
        error: expect.stringContaining('Connection lost'),
      }),
    )
  })

  it('calls checkpoint between policies', async () => {
    const params = {
      username: 'user',
      password: 'pass',
      policyNumbers: ['ABC123456', 'DEF789012'],
    }

    await runLoginAST(mockAti, params, mockReporter, mockCtx)

    expect(mockCtx.checkpoint).toHaveBeenCalledTimes(2)
  })

  it('calls logoff at the end', async () => {
    const params = {
      username: 'user',
      password: 'pass',
      policyNumbers: ['ABC123456'],
    }

    await runLoginAST(mockAti, params, mockReporter, mockCtx)

    expect(mockSession.logoff).toHaveBeenCalled()
  })

  it('handles empty policy list', async () => {
    const params = {
      username: 'user',
      password: 'pass',
      policyNumbers: [],
    }

    await runLoginAST(mockAti, params, mockReporter, mockCtx)

    expect(mockReporter.reportProgress).toHaveBeenCalledWith(1, 1, 'No policies to process')
    expect(mockCtx.checkpoint).not.toHaveBeenCalled()
    expect(mockSession.logoff).toHaveBeenCalled()
  })

  describe('resume: completedPolicies filtering', () => {
    it('skips policies in completedPolicies', async () => {
      mockCtx.completedPolicies = new Set(['ABC123456'])

      const params = {
        username: 'user',
        password: 'pass',
        policyNumbers: ['ABC123456', 'DEF789012'],
      }

      await runLoginAST(mockAti, params, mockReporter, mockCtx)

      // Only DEF789012 should be processed
      expect(mockReporter.addItem).toHaveBeenCalledTimes(1)
      expect(mockReporter.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          policyNumber: 'DEF789012',
          status: 'success',
        }),
      )
    })

    it('processes ALL policies when completedPolicies is empty (backward compat)', async () => {
      // completedPolicies is empty Set by default
      const params = {
        username: 'user',
        password: 'pass',
        policyNumbers: ['ABC123456', 'DEF789012'],
      }

      await runLoginAST(mockAti, params, mockReporter, mockCtx)

      expect(mockReporter.addItem).toHaveBeenCalledTimes(2)
      expect(mockReporter.addItem).toHaveBeenCalledWith(
        expect.objectContaining({ policyNumber: 'ABC123456', status: 'success' }),
      )
      expect(mockReporter.addItem).toHaveBeenCalledWith(
        expect.objectContaining({ policyNumber: 'DEF789012', status: 'success' }),
      )
    })

    it('reports resume skip message when completedPolicies is non-empty', async () => {
      mockCtx.completedPolicies = new Set(['ABC123456'])

      const params = {
        username: 'user',
        password: 'pass',
        policyNumbers: ['ABC123456', 'DEF789012'],
      }

      await runLoginAST(mockAti, params, mockReporter, mockCtx)

      expect(mockReporter.reportProgress).toHaveBeenCalledWith(
        2,
        2,
        'Resuming: skipped 1 already-completed items',
      )
    })

    it('does not report resume message when completedPolicies is empty', async () => {
      const params = {
        username: 'user',
        password: 'pass',
        policyNumbers: ['ABC123456'],
      }

      await runLoginAST(mockAti, params, mockReporter, mockCtx)

      expect(mockReporter.reportProgress).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.stringContaining('Resuming'),
      )
    })

    it('skips multiple completed policies and processes the rest', async () => {
      mockCtx.completedPolicies = new Set(['ABC123456', 'DEF789012'])

      const params = {
        username: 'user',
        password: 'pass',
        policyNumbers: ['ABC123456', 'DEF789012', 'GHI345678'],
      }

      await runLoginAST(mockAti, params, mockReporter, mockCtx)

      // Only GHI345678 should be processed
      expect(mockReporter.addItem).toHaveBeenCalledTimes(1)
      expect(mockReporter.addItem).toHaveBeenCalledWith(
        expect.objectContaining({ policyNumber: 'GHI345678', status: 'success' }),
      )
    })

    it('still calls checkpoint for skipped policies', async () => {
      mockCtx.completedPolicies = new Set(['ABC123456'])

      const params = {
        username: 'user',
        password: 'pass',
        policyNumbers: ['ABC123456', 'DEF789012'],
      }

      await runLoginAST(mockAti, params, mockReporter, mockCtx)

      // checkpoint called for every policy in the loop (2 total)
      expect(mockCtx.checkpoint).toHaveBeenCalledTimes(2)
    })
  })

  it('uses items param as fallback for policyNumbers', async () => {
    const params = {
      username: 'user',
      password: 'pass',
      items: ['XYZ987654'],
    }

    await runLoginAST(mockAti, params, mockReporter, mockCtx)

    expect(mockReporter.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        policyNumber: 'XYZ987654',
        status: 'success',
      }),
    )
  })
})
