import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('tnz3270-node', () => ({ Ati: class {} }))
vi.mock('worker_threads', () => ({ MessagePort: class { postMessage = vi.fn() } }))

import { Ati } from 'tnz3270-node'
import { MessagePort } from 'worker_threads'

const { mockExecuteAST, mockReportStatus, mockReportComplete } = vi.hoisted(() => {
  const mockReportStatus = vi.fn()
  const mockReportComplete = vi.fn()
  const mockExecuteAST = vi.fn()
  return { mockExecuteAST, mockReportStatus, mockReportComplete }
})

vi.mock('@src/ast/executor.js', () => ({
  executeAST: mockExecuteAST,
}))

vi.mock('@src/ast/progress.js', () => {
  return {
    ProgressReporter: class MockProgressReporter {
      reportStatus = mockReportStatus
      reportComplete = mockReportComplete
      reportProgress = vi.fn()
      addItem = vi.fn()
      flush = vi.fn()
      dispose = vi.fn()
    },
  }
})

import { runAST, controlAST } from '@src/ast/runner.js'

describe('runAST', () => {
  const mockAti = new Ati()
  const mockPort = new MessagePort()

  beforeEach(() => {
    vi.clearAllMocks()
    mockExecuteAST.mockReset()
  })

  it('creates a ProgressReporter and calls executeAST', async () => {
    mockExecuteAST.mockResolvedValue(undefined)

    await runAST(mockAti, 'login', { user: 'test' }, 'exe_001', mockPort)

    expect(mockReportStatus).toHaveBeenCalledWith('running', 'login')
    expect(mockExecuteAST).toHaveBeenCalledOnce()
    expect(mockExecuteAST).toHaveBeenCalledWith(
      mockAti,
      'login',
      { user: 'test' },
      expect.anything(), // reporter
      expect.objectContaining({
        checkpoint: expect.any(Function),
        completedPolicies: expect.any(Set),
      }),
    )
  })

  it('reports completed on successful execution', async () => {
    mockExecuteAST.mockResolvedValue(undefined)

    await runAST(mockAti, 'login', {}, 'exe_001', mockPort)

    expect(mockReportComplete).toHaveBeenCalledWith('completed')
  })

  it('reports failed on error', async () => {
    mockExecuteAST.mockRejectedValue(new Error('Something broke'))

    await runAST(mockAti, 'bi-renew', {}, 'exe_002', mockPort)

    expect(mockReportComplete).toHaveBeenCalledWith('failed', expect.stringContaining('Something broke'))
  })

  it('reports cancelled when AST_CANCELLED error is thrown', async () => {
    mockExecuteAST.mockRejectedValue(new Error('AST_CANCELLED'))

    await runAST(mockAti, 'rout-extractor', {}, 'exe_003', mockPort)

    expect(mockReportComplete).toHaveBeenCalledWith('cancelled')
  })

  it('passes completedPolicies array as a Set to executeAST', async () => {
    mockExecuteAST.mockResolvedValue(undefined)

    await runAST(mockAti, 'login', { user: 'test' }, 'exe_010', mockPort, ['POL1', 'POL2'])

    expect(mockExecuteAST).toHaveBeenCalledWith(
      mockAti,
      'login',
      { user: 'test' },
      expect.anything(),
      expect.objectContaining({
        completedPolicies: new Set(['POL1', 'POL2']),
      }),
    )
  })

  it('passes empty Set when no completedPolicies provided', async () => {
    mockExecuteAST.mockResolvedValue(undefined)

    await runAST(mockAti, 'bi-renew', {}, 'exe_011', mockPort)

    expect(mockExecuteAST).toHaveBeenCalledWith(
      mockAti,
      'bi-renew',
      {},
      expect.anything(),
      expect.objectContaining({
        completedPolicies: new Set(),
      }),
    )
  })

  it('passes empty Set when completedPolicies is undefined', async () => {
    mockExecuteAST.mockResolvedValue(undefined)

    await runAST(mockAti, 'rout-extractor', {}, 'exe_012', mockPort, undefined)

    expect(mockExecuteAST).toHaveBeenCalledWith(
      mockAti,
      'rout-extractor',
      {},
      expect.anything(),
      expect.objectContaining({
        completedPolicies: new Set(),
      }),
    )
  })

  it('passes empty Set when completedPolicies is empty array', async () => {
    mockExecuteAST.mockResolvedValue(undefined)

    await runAST(mockAti, 'login', {}, 'exe_013', mockPort, [])

    expect(mockExecuteAST).toHaveBeenCalledWith(
      mockAti,
      'login',
      {},
      expect.anything(),
      expect.objectContaining({
        completedPolicies: new Set(),
      }),
    )
  })

  it('reports initial running status with the AST name', async () => {
    mockExecuteAST.mockResolvedValue(undefined)

    await runAST(mockAti, 'bi-renew', {}, 'exe_004', mockPort)

    expect(mockReportStatus).toHaveBeenCalledWith('running', 'bi-renew')
  })
})

describe('controlAST', () => {
  const mockAti = new Ati()
  const mockPort = new MessagePort()

  beforeEach(() => {
    vi.clearAllMocks()
    mockExecuteAST.mockReset()
  })

  it('pause sets paused state and reports paused status', async () => {
    let checkpointResolve: (() => void) | undefined
    mockExecuteAST.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        checkpointResolve = resolve
      })
    })

    const promise = runAST(mockAti, 'login', {}, 'exe_005', mockPort)
    await vi.waitFor(() => expect(mockExecuteAST).toHaveBeenCalled())

    controlAST('pause')
    expect(mockReportStatus).toHaveBeenCalledWith('paused', '')

    checkpointResolve?.()
    await promise
  })

  it('resume clears paused state and reports running status', async () => {
    let checkpointResolve: (() => void) | undefined
    mockExecuteAST.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        checkpointResolve = resolve
      })
    })

    const promise = runAST(mockAti, 'login', {}, 'exe_006', mockPort)
    await vi.waitFor(() => expect(mockExecuteAST).toHaveBeenCalled())

    controlAST('pause')
    controlAST('resume')
    expect(mockReportStatus).toHaveBeenCalledWith('running', '')

    checkpointResolve?.()
    await promise
  })

  it('cancel sets cancelled flag', async () => {
    let checkpointResolve: (() => void) | undefined
    mockExecuteAST.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        checkpointResolve = resolve
      })
    })

    const promise = runAST(mockAti, 'login', {}, 'exe_007', mockPort)
    await vi.waitFor(() => expect(mockExecuteAST).toHaveBeenCalled())

    controlAST('cancel')

    checkpointResolve?.()
    await promise
  })
})
