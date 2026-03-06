import { Worker } from 'worker_threads'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import type { WebSocket } from '@fastify/websocket'
import type { MainToWorkerMessage } from './worker-messages.js'
import { config } from '../config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface WorkerEntry {
  worker: Worker
  ws: WebSocket | null
}

class TerminalManager {
  private workers = new Map<string, WorkerEntry>()
  private maxWorkers = config.maxWorkers

  createWorker(sessionId: string): Worker {
    if (this.workers.size >= this.maxWorkers) {
      throw new Error(`Max workers (${this.maxWorkers}) reached`)
    }

    if (this.workers.has(sessionId)) {
      return this.workers.get(sessionId)!.worker
    }

    const worker = new Worker(join(__dirname, 'worker.js'), {
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

    this.workers.set(sessionId, { worker, ws: null })
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
    entry.ws = ws
  }

  detachWebSocket(sessionId: string): void {
    const entry = this.workers.get(sessionId)
    if (!entry) return
    entry.ws = null
  }

  getWorker(sessionId: string): Worker | undefined {
    return this.workers.get(sessionId)?.worker
  }

  getWebSocket(sessionId: string): WebSocket | null | undefined {
    return this.workers.get(sessionId)?.ws
  }

  destroySession(sessionId: string): void {
    const entry = this.workers.get(sessionId)
    if (!entry) return

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
