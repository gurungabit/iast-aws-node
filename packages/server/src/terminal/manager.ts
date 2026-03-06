import { Worker } from 'worker_threads'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import type { WebSocket } from '@fastify/websocket'
import type { MainToWorkerMessage } from './worker-messages.js'
import { config } from '../config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const isTsx = __filename.endsWith('.ts')
const workerFile = join(__dirname, isTsx ? 'worker-entry.mjs' : 'worker.js')

interface WorkerEntry {
  worker: Worker
  ws: WebSocket | null
  idleTimer: ReturnType<typeof setTimeout> | null
}

class TerminalManager {
  private workers = new Map<string, WorkerEntry>()
  private maxWorkers = config.maxWorkers
  private idleTimeoutMs = config.workerIdleTimeoutMs

  createWorker(sessionId: string): Worker {
    if (this.workers.size >= this.maxWorkers) {
      throw new Error(`Max workers (${this.maxWorkers}) reached`)
    }

    if (this.workers.has(sessionId)) {
      return this.workers.get(sessionId)!.worker
    }

    const worker = new Worker(workerFile, {
      workerData: {
        sessionId,
        tn3270Host: config.tn3270Host,
        tn3270Port: config.tn3270Port,
        tn3270Secure: config.tn3270Secure,
      },
    })

    worker.on('error', (err) => {
      console.error(`Worker ${sessionId} error:`, err)
      this.destroySession(sessionId)
    })

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker ${sessionId} exited with code ${code}`)
      }
      this.workers.delete(sessionId)
    })

    this.workers.set(sessionId, { worker, ws: null, idleTimer: null })
    this.startIdleTimer(sessionId)
    return worker
  }

  getOrCreateWorker(sessionId: string): Worker {
    const entry = this.workers.get(sessionId)
    if (entry) return entry.worker
    return this.createWorker(sessionId)
  }

  attachWebSocket(sessionId: string, ws: WebSocket): void {
    const entry = this.workers.get(sessionId)
    if (!entry) return
    this.clearIdleTimer(sessionId)
    entry.ws = ws
  }

  detachWebSocket(sessionId: string): void {
    const entry = this.workers.get(sessionId)
    if (!entry) return
    entry.ws = null
    this.startIdleTimer(sessionId)
  }

  getWorker(sessionId: string): Worker | undefined {
    return this.workers.get(sessionId)?.worker
  }

  getWebSocket(sessionId: string): WebSocket | null | undefined {
    return this.workers.get(sessionId)?.ws
  }

  private startIdleTimer(sessionId: string): void {
    this.clearIdleTimer(sessionId)
    const entry = this.workers.get(sessionId)
    if (!entry) return

    entry.idleTimer = setTimeout(() => {
      const current = this.workers.get(sessionId)
      if (current && !current.ws) {
        console.log(`Worker ${sessionId} idle for ${this.idleTimeoutMs / 1000}s, destroying`)
        this.destroySession(sessionId)
      }
    }, this.idleTimeoutMs)
  }

  private clearIdleTimer(sessionId: string): void {
    const entry = this.workers.get(sessionId)
    if (!entry?.idleTimer) return
    clearTimeout(entry.idleTimer)
    entry.idleTimer = null
  }

  destroySession(sessionId: string): void {
    const entry = this.workers.get(sessionId)
    if (!entry) return

    this.clearIdleTimer(sessionId)

    try {
      entry.worker.postMessage({ type: 'disconnect' } satisfies MainToWorkerMessage)
    } catch {
      // ignore
    }

    setTimeout(() => {
      try {
        entry.worker.terminate()
      } catch {
        // ignore
      }
    }, 1000)

    this.workers.delete(sessionId)
  }

  getActiveCount(): number {
    return this.workers.size
  }

  getMaxWorkers(): number {
    return this.maxWorkers
  }

  destroyAll(): void {
    for (const sessionId of this.workers.keys()) {
      this.destroySession(sessionId)
    }
  }
}

export const terminalManager = new TerminalManager()
