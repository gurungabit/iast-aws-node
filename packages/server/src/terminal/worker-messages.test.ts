import { describe, it, expect } from 'vitest'
import type { MainToWorkerMessage, WorkerToMainMessage, ScreenMeta } from './worker-messages.js'

/**
 * Type-level tests for worker message types.
 * These tests validate that the message type discriminants and shapes
 * are correct by constructing valid messages and asserting their structure.
 */

describe('MainToWorkerMessage types', () => {
  it('connect message has type "connect"', () => {
    const msg: MainToWorkerMessage = { type: 'connect' }
    expect(msg.type).toBe('connect')
  })

  it('disconnect message has type "disconnect"', () => {
    const msg: MainToWorkerMessage = { type: 'disconnect' }
    expect(msg.type).toBe('disconnect')
  })

  it('key message has type "key" and key field', () => {
    const msg: MainToWorkerMessage = { type: 'key', key: 'Enter' }
    expect(msg.type).toBe('key')
    expect(msg.key).toBe('Enter')
  })

  it('data message has type "data" and text field', () => {
    const msg: MainToWorkerMessage = { type: 'data', text: 'hello' }
    expect(msg.type).toBe('data')
    expect(msg.text).toBe('hello')
  })

  it('cursor message has type "cursor" with row and col', () => {
    const msg: MainToWorkerMessage = { type: 'cursor', row: 10, col: 20 }
    expect(msg.type).toBe('cursor')
    expect(msg.row).toBe(10)
    expect(msg.col).toBe(20)
  })

  it('ast.run message has astName, params, and executionId', () => {
    const msg: MainToWorkerMessage = {
      type: 'ast.run',
      astName: 'login',
      params: { user: 'test' },
      executionId: 'exe_001',
    }
    expect(msg.type).toBe('ast.run')
    expect(msg.astName).toBe('login')
    expect(msg.params).toEqual({ user: 'test' })
    expect(msg.executionId).toBe('exe_001')
  })

  it('ast.control message has action field', () => {
    const pause: MainToWorkerMessage = { type: 'ast.control', action: 'pause' }
    expect(pause.type).toBe('ast.control')
    expect(pause.action).toBe('pause')

    const resume: MainToWorkerMessage = { type: 'ast.control', action: 'resume' }
    expect(resume.action).toBe('resume')

    const cancel: MainToWorkerMessage = { type: 'ast.control', action: 'cancel' }
    expect(cancel.action).toBe('cancel')
  })
})

describe('WorkerToMainMessage types', () => {
  it('connected message has type "connected"', () => {
    const msg: WorkerToMainMessage = { type: 'connected' }
    expect(msg.type).toBe('connected')
  })

  it('disconnected message has type "disconnected" with optional reason', () => {
    const msg1: WorkerToMainMessage = { type: 'disconnected' }
    expect(msg1.type).toBe('disconnected')

    const msg2: WorkerToMainMessage = { type: 'disconnected', reason: 'timeout' }
    expect(msg2.type).toBe('disconnected')
    expect(msg2.reason).toBe('timeout')
  })

  it('screen message has ansi and meta fields', () => {
    const meta: ScreenMeta = {
      cursorRow: 1,
      cursorCol: 1,
      locked: false,
      rows: 24,
      cols: 80,
    }
    const msg: WorkerToMainMessage = { type: 'screen', ansi: '\x1b[2J', meta }
    expect(msg.type).toBe('screen')
    expect(msg.ansi).toBe('\x1b[2J')
    expect(msg.meta).toEqual(meta)
  })

  it('ast.status message has status, astName, and executionId', () => {
    const msg: WorkerToMainMessage = {
      type: 'ast.status',
      status: 'running',
      astName: 'login',
      executionId: 'exe_001',
    }
    expect(msg.type).toBe('ast.status')
    expect(msg.status).toBe('running')
    expect(msg.astName).toBe('login')
    expect(msg.executionId).toBe('exe_001')
  })

  it('ast.progress message has progress object', () => {
    const msg: WorkerToMainMessage = {
      type: 'ast.progress',
      progress: { current: 5, total: 10, message: 'Processing...' },
    }
    expect(msg.type).toBe('ast.progress')
    expect(msg.progress.current).toBe(5)
    expect(msg.progress.total).toBe(10)
    expect(msg.progress.message).toBe('Processing...')
  })

  it('ast.item_result_batch message has executionId and items array', () => {
    const msg: WorkerToMainMessage = {
      type: 'ast.item_result_batch',
      executionId: 'exe_001',
      items: [
        {
          id: '1',
          policyNumber: 'POL1',
          status: 'success',
          durationMs: 100,
        },
      ],
    }
    expect(msg.type).toBe('ast.item_result_batch')
    expect(msg.executionId).toBe('exe_001')
    expect(msg.items).toHaveLength(1)
    expect(msg.items[0].status).toBe('success')
  })

  it('ast.complete message has status, executionId, and optional error', () => {
    const msg1: WorkerToMainMessage = {
      type: 'ast.complete',
      status: 'completed',
      executionId: 'exe_001',
    }
    expect(msg1.type).toBe('ast.complete')
    expect(msg1.status).toBe('completed')

    const msg2: WorkerToMainMessage = {
      type: 'ast.complete',
      status: 'failed',
      executionId: 'exe_001',
      error: 'Something went wrong',
    }
    expect(msg2.error).toBe('Something went wrong')
  })

  it('error message has message field', () => {
    const msg: WorkerToMainMessage = { type: 'error', message: 'Connection lost' }
    expect(msg.type).toBe('error')
    expect(msg.message).toBe('Connection lost')
  })
})

describe('ScreenMeta', () => {
  it('has the correct shape', () => {
    const meta: ScreenMeta = {
      cursorRow: 0,
      cursorCol: 0,
      locked: true,
      rows: 24,
      cols: 80,
    }
    expect(meta.cursorRow).toBe(0)
    expect(meta.cursorCol).toBe(0)
    expect(meta.locked).toBe(true)
    expect(meta.rows).toBe(24)
    expect(meta.cols).toBe(80)
  })
})
