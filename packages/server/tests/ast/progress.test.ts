import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('worker_threads', () => ({
  MessagePort: class {
    postMessage = vi.fn()
  },
}))

import { MessagePort } from 'worker_threads'
import { ProgressReporter } from '@src/ast/progress.js'
import type { ASTItemResult } from '@src/types.js'

function createMockPort() {
  return new MessagePort()
}

function createItemResult(id: string): ASTItemResult {
  return {
    id,
    policyNumber: `POL-${id}`,
    status: 'success',
    durationMs: 100,
  }
}

describe('ProgressReporter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('creates a reporter with executionId and port', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)
      expect(reporter).toBeInstanceOf(ProgressReporter)
      reporter.dispose()
    })

    it('sets up a flush interval timer', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      // Add an item so flush has something to send
      reporter.addItem(createItemResult('1'))

      // Advance past the flush interval (200ms)
      vi.advanceTimersByTime(200)

      // flush should have been called and sent the item
      expect(port.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ast.item_result_batch' }),
      )
      reporter.dispose()
    })
  })

  describe('addItem', () => {
    it('buffers items without sending immediately (below batch size)', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.addItem(createItemResult('1'))

      // No message sent yet (batch size = 50, only 1 item)
      expect(port.postMessage).not.toHaveBeenCalled()
      reporter.dispose()
    })

    it('flushes automatically when batch size (50) is reached', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      for (let i = 0; i < 50; i++) {
        reporter.addItem(createItemResult(String(i)))
      }

      // Should have flushed once (at 50 items)
      expect(port.postMessage).toHaveBeenCalledTimes(1)
      const msg = vi.mocked(port.postMessage).mock.calls[0][0]
      expect(msg.type).toBe('ast.item_result_batch')
      expect(msg.executionId).toBe('exe_123')
      expect(msg.items).toHaveLength(50)
      reporter.dispose()
    })

    it('flushes multiple times when adding more than BATCH_SIZE items', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      for (let i = 0; i < 120; i++) {
        reporter.addItem(createItemResult(String(i)))
      }

      // 120 items -> 2 flushes at 50, 20 remaining in buffer
      expect(port.postMessage).toHaveBeenCalledTimes(2)
      expect(vi.mocked(port.postMessage).mock.calls[0][0].items).toHaveLength(50)
      expect(vi.mocked(port.postMessage).mock.calls[1][0].items).toHaveLength(50)
      reporter.dispose()
    })
  })

  describe('flush', () => {
    it('sends buffered items as ast.item_result_batch message', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.addItem(createItemResult('1'))
      reporter.addItem(createItemResult('2'))
      reporter.flush()

      expect(port.postMessage).toHaveBeenCalledWith({
        type: 'ast.item_result_batch',
        executionId: 'exe_123',
        items: [createItemResult('1'), createItemResult('2')],
      })
      reporter.dispose()
    })

    it('does nothing when buffer is empty', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.flush()

      expect(port.postMessage).not.toHaveBeenCalled()
      reporter.dispose()
    })

    it('clears the buffer after flushing', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.addItem(createItemResult('1'))
      reporter.flush()
      reporter.flush()

      // Second flush should not send anything
      expect(port.postMessage).toHaveBeenCalledTimes(1)
      reporter.dispose()
    })
  })

  describe('reportProgress', () => {
    it('sends an ast.progress message', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.reportProgress(5, 10, 'Processing...')

      expect(port.postMessage).toHaveBeenCalledWith({
        type: 'ast.progress',
        progress: { current: 5, total: 10, message: 'Processing...' },
      })
      reporter.dispose()
    })

    it('sends multiple progress updates', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.reportProgress(1, 100, 'Starting')
      reporter.reportProgress(50, 100, 'Halfway')
      reporter.reportProgress(100, 100, 'Done')

      expect(port.postMessage).toHaveBeenCalledTimes(3)
      reporter.dispose()
    })
  })

  describe('reportStatus', () => {
    it('sends an ast.status message', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.reportStatus('running', 'login')

      expect(port.postMessage).toHaveBeenCalledWith({
        type: 'ast.status',
        status: 'running',
        astName: 'login',
        executionId: 'exe_123',
      })
      reporter.dispose()
    })

    it('sends paused status', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.reportStatus('paused', 'bi-renew')

      expect(port.postMessage).toHaveBeenCalledWith({
        type: 'ast.status',
        status: 'paused',
        astName: 'bi-renew',
        executionId: 'exe_123',
      })
      reporter.dispose()
    })

    it('sends completed status', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.reportStatus('completed', 'rout-extractor')

      expect(port.postMessage).toHaveBeenCalledWith({
        type: 'ast.status',
        status: 'completed',
        astName: 'rout-extractor',
        executionId: 'exe_123',
      })
      reporter.dispose()
    })

    it('sends failed status', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_456', port)

      reporter.reportStatus('failed', 'login')

      expect(port.postMessage).toHaveBeenCalledWith({
        type: 'ast.status',
        status: 'failed',
        astName: 'login',
        executionId: 'exe_456',
      })
      reporter.dispose()
    })
  })

  describe('reportComplete', () => {
    it('flushes remaining items, sends ast.complete, and disposes', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.addItem(createItemResult('1'))
      reporter.reportComplete('completed')

      // Should have: 1) flushed items, 2) sent complete message
      expect(port.postMessage).toHaveBeenCalledTimes(2)

      // First call: flush
      expect(vi.mocked(port.postMessage).mock.calls[0][0].type).toBe('ast.item_result_batch')
      expect(vi.mocked(port.postMessage).mock.calls[0][0].items).toHaveLength(1)

      // Second call: complete
      expect(vi.mocked(port.postMessage).mock.calls[1][0]).toEqual({
        type: 'ast.complete',
        status: 'completed',
        executionId: 'exe_123',
        error: undefined,
      })
    })

    it('sends complete with failed status and error message', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.reportComplete('failed', 'Something went wrong')

      expect(port.postMessage).toHaveBeenCalledWith({
        type: 'ast.complete',
        status: 'failed',
        executionId: 'exe_123',
        error: 'Something went wrong',
      })
    })

    it('sends complete with cancelled status', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.reportComplete('cancelled')

      expect(port.postMessage).toHaveBeenCalledWith({
        type: 'ast.complete',
        status: 'cancelled',
        executionId: 'exe_123',
        error: undefined,
      })
    })

    it('does not flush again if buffer is empty at complete time', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.reportComplete('completed')

      // Only the complete message (no flush since buffer was empty)
      expect(port.postMessage).toHaveBeenCalledTimes(1)
      expect(vi.mocked(port.postMessage).mock.calls[0][0].type).toBe('ast.complete')
    })
  })

  describe('dispose', () => {
    it('clears the interval timer', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.addItem(createItemResult('1'))
      reporter.dispose()

      // After dispose, advancing timers should not trigger flush
      vi.advanceTimersByTime(1000)

      // The item should not have been flushed by the timer
      expect(port.postMessage).not.toHaveBeenCalled()
    })

    it('can be called multiple times safely', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.dispose()
      reporter.dispose()
      // No error thrown
    })
  })

  describe('periodic flush via timer', () => {
    it('flushes buffer every 200ms via setInterval', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      reporter.addItem(createItemResult('1'))
      vi.advanceTimersByTime(200)

      expect(port.postMessage).toHaveBeenCalledTimes(1)
      expect(vi.mocked(port.postMessage).mock.calls[0][0].type).toBe('ast.item_result_batch')

      reporter.addItem(createItemResult('2'))
      vi.advanceTimersByTime(200)

      expect(port.postMessage).toHaveBeenCalledTimes(2)
      reporter.dispose()
    })

    it('does not send empty flushes via timer', () => {
      const port = createMockPort()
      const reporter = new ProgressReporter('exe_123', port)

      // Advance several intervals with no items
      vi.advanceTimersByTime(1000)

      expect(port.postMessage).not.toHaveBeenCalled()
      reporter.dispose()
    })
  })
})
