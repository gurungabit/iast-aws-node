import type { ASTItemResult, WorkerToMainMessage } from '../terminal/worker-messages.js'
import type { MessagePort } from 'worker_threads'

const BATCH_SIZE = 500
const FLUSH_INTERVAL_MS = 300

export class ProgressReporter {
  private buffer: ASTItemResult[] = []
  private persistBuffer: ASTItemResult[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private executionId: string
  private port: MessagePort

  constructor(executionId: string, port: MessagePort) {
    this.executionId = executionId
    this.port = port
    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS)
  }

  /** Add an item that gets sent to browser AND persisted to DB. */
  addItem(item: ASTItemResult) {
    this.buffer.push(item)
    if (this.buffer.length >= BATCH_SIZE) {
      this.flush()
    }
  }

  /** Add items that get sent to browser AND persisted to DB. */
  addItems(items: ASTItemResult[]) {
    this.buffer.push(...items)
    if (this.buffer.length >= BATCH_SIZE) {
      this.flush()
    }
  }

  /** Add items that only get persisted to DB — NOT sent to browser. */
  addItemsPersistOnly(items: ASTItemResult[]) {
    this.persistBuffer.push(...items)
    if (this.persistBuffer.length >= BATCH_SIZE) {
      this.flushPersist()
    }
  }

  reportProgress(current: number, total: number, message: string) {
    this.send({
      type: 'ast.progress',
      progress: { current, total, message },
    })
  }

  reportStatus(
    status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled',
    astName: string,
  ) {
    this.send({
      type: 'ast.status',
      status,
      astName: astName as 'login' | 'bi-renew' | 'rout-extractor',
      executionId: this.executionId,
    })
  }

  reportComplete(status: 'completed' | 'failed' | 'cancelled', error?: string) {
    this.flush()
    this.flushPersist()
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

  private flushPersist() {
    if (this.persistBuffer.length === 0) return
    const items = this.persistBuffer.splice(0)
    this.send({
      type: 'ast.item_result_batch',
      executionId: this.executionId,
      items,
      persistOnly: true,
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
