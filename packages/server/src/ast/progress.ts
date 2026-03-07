import type { ASTItemResult, WorkerToMainMessage } from '../terminal/worker-messages.js'
import type { MessagePort } from 'worker_threads'

const BATCH_SIZE = 500
const FLUSH_INTERVAL_MS = 300

export class ProgressReporter {
  private buffer: ASTItemResult[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private executionId: string
  private port: MessagePort

  constructor(executionId: string, port: MessagePort) {
    this.executionId = executionId
    this.port = port
    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS)
  }

  addItem(item: ASTItemResult) {
    this.buffer.push(item)
    if (this.buffer.length >= BATCH_SIZE) {
      this.flush()
    }
  }

  /** Add multiple items at once (avoids per-item flush checks). */
  addItems(items: ASTItemResult[]) {
    this.buffer.push(...items)
    if (this.buffer.length >= BATCH_SIZE) {
      this.flush()
    }
  }

  reportProgress(current: number, total: number, message: string) {
    this.send({
      type: 'ast.progress',
      progress: { current, total, message },
    })
  }

  reportStatus(status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled', astName: string) {
    this.send({
      type: 'ast.status',
      status,
      astName: astName as 'login' | 'bi-renew' | 'rout-extractor',
      executionId: this.executionId,
    })
  }

  reportComplete(status: 'completed' | 'failed' | 'cancelled', error?: string) {
    this.flush()
    this.send({
      type: 'ast.complete',
      status,
      executionId: this.executionId,
      error,
    })
    this.dispose()
  }

  flush() {
    if (this.buffer.length === 0) return
    const items = this.buffer.splice(0)
    this.send({
      type: 'ast.item_result_batch',
      executionId: this.executionId,
      items,
    })
  }

  dispose() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private send(msg: WorkerToMainMessage) {
    this.port.postMessage(msg)
  }
}
