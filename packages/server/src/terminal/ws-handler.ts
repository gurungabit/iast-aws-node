// ============================================================================
// WebSocket Terminal Handler - Session Routing + Cross-Pod Proxy
//
// When a browser connects, we look up which pod owns the session in PostgreSQL.
// If this pod owns it, we attach directly to the local Worker thread.
// If another pod owns it, we proxy via an internal WebSocket to that pod.
// If no assignment exists, we assign to the least-loaded pod.
// ============================================================================

import type { FastifyInstance } from 'fastify'
import WebSocket from 'ws'
import { terminalManager } from './manager.js'
import { verifyWsToken } from '../auth/ws-auth.js'
import { executionService } from '../services/execution.js'
import {
  getSessionAssignment,
  registerSessionAssignment,
  terminateSessionAssignment,
  getLeastLoadedPod,
  isPodAlive,
  discoverPods,
} from './registry.js'
import { config } from '../config.js'
import type { ASTItemResult, WorkerToMainMessage } from './worker-messages.js'

const MY_POD_IP = config.podIp

/**
 * Attach a browser WebSocket directly to a local Worker thread.
 * Used when this pod owns the session.
 *
 * @param pendingMessages - Messages buffered during async setup (auth, routing)
 *   that arrived before this handler was registered.
 */
function attachLocal(
  socket: WebSocket,
  sessionId: string,
  userId: string,
  pendingMessages?: unknown[],
) {
  const worker = terminalManager.getOrCreateWorker(sessionId)
  terminalManager.attachWebSocket(sessionId, socket as never)

  // Browser → Worker (intercept ast.run to create execution record)
  const forwardToWorker = async (msg: Record<string, unknown>) => {
    if (msg.type === 'ast.run') {
      const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const today = new Date().toISOString().slice(0, 10)
      try {
        const params = (msg.params ?? {}) as Record<string, unknown>
        await executionService.create({
          id: executionId,
          sessionId,
          userId,
          astName: String(msg.astName),
          configName: typeof params.configName === 'string' ? params.configName : undefined,
          hostUser: typeof params.username === 'string' ? params.username : undefined,
          executionDate: today,
        })
      } catch (err) {
        console.error(
          'Failed to create execution:',
          err instanceof Error ? err.message : String(err),
        )
      }
      worker.postMessage({ ...msg, executionId })
    } else {
      worker.postMessage(msg)
    }
  }

  socket.on('message', (data) => {
    try {
      const msg = JSON.parse(String(data))
      forwardToWorker(msg).catch(() => {})
    } catch {
      // ignore malformed
    }
  })

  // ── DB write buffer (decoupled from WS forwarding) ──
  // Accumulate items and flush to DB in large batches for throughput.
  const DB_FLUSH_SIZE = 5000
  const DB_FLUSH_INTERVAL_MS = 1000
  let dbBuffer: { executionId: string; items: ASTItemResult[] }[] = []
  let dbFlushTimer: ReturnType<typeof setInterval> | null = null

  const flushDbBuffer = () => {
    if (dbBuffer.length === 0) return
    const batches = dbBuffer
    dbBuffer = []

    // Group by executionId and merge
    const grouped = new Map<string, ASTItemResult[]>()
    for (const batch of batches) {
      const existing = grouped.get(batch.executionId)
      if (existing) {
        existing.push(...batch.items)
      } else {
        grouped.set(batch.executionId, [...batch.items])
      }
    }

    for (const [execId, items] of grouped) {
      executionService.batchInsertPolicies(execId, items).catch((err) => {
        const cause =
          err instanceof Error && 'cause' in err && err.cause instanceof Error
            ? err.cause.message
            : ''
        console.error(
          `Failed to persist policies: ${cause || (err instanceof Error ? err.constructor.name : 'unknown error')}`,
        )
      })
    }
  }

  dbFlushTimer = setInterval(flushDbBuffer, DB_FLUSH_INTERVAL_MS)

  // Worker → Browser
  const onWorkerMessage = (msg: WorkerToMainMessage) => {
    try {
      if (msg.type === 'ast.item_result_batch') {
        // Buffer for DB (large batch writes)
        dbBuffer.push({ executionId: msg.executionId, items: msg.items })
        const totalBuffered = dbBuffer.reduce((n, b) => n + b.items.length, 0)
        if (totalBuffered >= DB_FLUSH_SIZE) {
          flushDbBuffer()
        }

        // persistOnly batches: DB only, don't forward items to browser
        if (msg.persistOnly) return
      }
      if (msg.type === 'ast.status') {
        // Persist paused/running status transitions to DB
        if (msg.status === 'paused' || msg.status === 'running') {
          executionService.updateStatus(msg.executionId, msg.status).catch(() => {})
        }
      }
      if (msg.type === 'ast.complete') {
        // Flush remaining items before completion
        flushDbBuffer()
        // Update execution status in DB
        executionService.updateStatus(msg.executionId, msg.status).catch((err) => {
          console.error(
            `Failed to update execution status: ${err instanceof Error ? err.message : String(err)}`,
          )
        })
        if (msg.status === 'failed') {
          console.error(`[worker:${sessionId}] AST failed: ${msg.error}`)
        }
      }
      if (msg.type === 'error') {
        console.error(`[worker:${sessionId}] ${msg.message}`)
      }
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(msg))
      }
    } catch {
      // ignore
    }
  }

  worker.on('message', onWorkerMessage)

  const cleanup = () => {
    flushDbBuffer()
    if (dbFlushTimer) {
      clearInterval(dbFlushTimer)
      dbFlushTimer = null
    }
    worker.off('message', onWorkerMessage)
    terminalManager.detachWebSocket(sessionId)
  }

  socket.on('close', cleanup)
  socket.on('error', cleanup)

  // Replay any messages that arrived during async setup
  if (pendingMessages?.length) {
    for (const msg of pendingMessages) {
      worker.postMessage(msg)
    }
  }

}

/**
 * Proxy a browser WebSocket to another pod's internal endpoint.
 * Bridges: Browser WS <-> Internal WS to remote pod.
 */
function proxyToRemotePod(
  browserSocket: WebSocket,
  podIp: string,
  sessionId: string,
  log: FastifyInstance['log'],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const internalUrl = `ws://${podIp}:${config.port}/internal/terminal/${sessionId}`
    log.info({ sessionId, internalUrl }, 'Proxying to remote pod')

    const remoteWs = new WebSocket(internalUrl)

    remoteWs.on('open', () => {
      log.info({ sessionId, podIp }, 'Remote pod connected, bridge established')

      // Browser → Remote pod
      browserSocket.on('message', (data) => {
        if (remoteWs.readyState === WebSocket.OPEN) {
          remoteWs.send(data)
        }
      })

      // Remote pod → Browser
      remoteWs.on('message', (data) => {
        if (browserSocket.readyState === WebSocket.OPEN) {
          browserSocket.send(data)
        }
      })

      // Handle remote disconnect
      remoteWs.on('close', () => {
        if (browserSocket.readyState === WebSocket.OPEN) {
          browserSocket.close(4001, 'Session terminated')
        }
      })

      remoteWs.on('error', (err) => {
        log.error({ sessionId, err: err.message }, 'Remote pod WebSocket error')
        if (browserSocket.readyState === WebSocket.OPEN) {
          browserSocket.close(4002, 'Terminal error')
        }
      })

      // Handle browser disconnect → close remote
      browserSocket.on('close', () => {
        if (remoteWs.readyState === WebSocket.OPEN) {
          remoteWs.close()
        }
      })

      browserSocket.on('error', () => {
        if (remoteWs.readyState === WebSocket.OPEN) {
          remoteWs.close()
        }
      })

      resolve()
    })

    remoteWs.on('error', (err) => {
      reject(err)
    })
  })
}

export async function terminalWsRoutes(app: FastifyInstance) {
  // ── Public endpoint: browser connects here ──────────────────────────────
  app.get('/api/terminal/:sessionId', { websocket: true }, async (socket, req) => {
    const sessionId = (req.params as { sessionId: string }).sessionId
    const wsSocket = socket as unknown as WebSocket

    // Buffer messages that arrive during async auth/routing setup.
    // The browser may send { type: 'connect' } before we've registered
    // the real message handler — without buffering, that message is lost
    // and the terminal stays stuck on "Connecting...".
    const pendingMessages: unknown[] = []
    const bufferHandler = (data: unknown) => {
      try {
        pendingMessages.push(JSON.parse(String(data)))
      } catch {
        // ignore malformed
      }
    }
    wsSocket.on('message', bufferHandler)

    const url = new URL(req.url, `http://${req.headers.host}`)
    const token = url.searchParams.get('token') ?? undefined
    const user = await verifyWsToken(token)

    if (!user) {
      wsSocket.off('message', bufferHandler)
      socket.close(4001, 'Unauthorized')
      return
    }

    const userId = user.id

    // Look up existing assignment
    let assignment = await getSessionAssignment(sessionId)

    if (!assignment || assignment.status === 'terminated') {
      // New session — assign to least-loaded pod
      const podIp = await getLeastLoadedPod()
      await registerSessionAssignment(sessionId, podIp, userId)
      assignment = { podIp, userId, status: 'active' }
      app.log.info({ sessionId, podIp }, 'New session assigned to pod')
    }

    const ownerPodIp = assignment.podIp

    // Remove buffer handler before attaching the real one
    wsSocket.off('message', bufferHandler)

    // Fast path: session is on this pod
    if (ownerPodIp === MY_POD_IP) {
      attachLocal(wsSocket, sessionId, userId, pendingMessages)
      return
    }

    // Cross-pod: proxy to the owning pod
    try {
      await proxyToRemotePod(wsSocket, ownerPodIp, sessionId, app)
      // Replay buffered messages to remote pod
      for (const msg of pendingMessages) {
        if (wsSocket.readyState === WebSocket.OPEN) {
          wsSocket.send(JSON.stringify(msg))
        }
      }
    } catch {
      // Connection to remote pod failed — check if pod is alive
      app.log.warn({ sessionId, ownerPodIp }, 'Remote pod connection failed, checking health')

      const currentPods = await discoverPods()
      const alive = await isPodAlive(ownerPodIp, currentPods)

      if (!alive) {
        // Pod is dead — reassign to a new pod
        app.log.info({ sessionId, deadPodIp: ownerPodIp }, 'Pod dead, reassigning session')
        await terminateSessionAssignment(sessionId)
        const newPodIp = await getLeastLoadedPod(currentPods)
        await registerSessionAssignment(sessionId, newPodIp, userId)

        if (newPodIp === MY_POD_IP) {
          attachLocal(wsSocket, sessionId, userId, pendingMessages)
        } else {
          try {
            await proxyToRemotePod(wsSocket, newPodIp, sessionId, app)
            for (const msg of pendingMessages) {
              if (wsSocket.readyState === WebSocket.OPEN) {
                wsSocket.send(JSON.stringify(msg))
              }
            }
          } catch (retryErr) {
            app.log.error({ sessionId, err: retryErr }, 'Retry to new pod failed')
            socket.close(4003, 'Terminal unavailable')
          }
        }
      } else {
        // Pod alive but transient failure — retry once after delay
        app.log.info({ sessionId, ownerPodIp }, 'Pod alive, retrying after delay')
        await new Promise((r) => setTimeout(r, 1000))
        try {
          await proxyToRemotePod(wsSocket, ownerPodIp, sessionId, app)
          for (const msg of pendingMessages) {
            if (wsSocket.readyState === WebSocket.OPEN) {
              wsSocket.send(JSON.stringify(msg))
            }
          }
        } catch {
          socket.close(4003, 'Terminal unavailable')
        }
      }
    }
  })

  // ── Internal endpoint: pod-to-pod proxy target ──────────────────────────
  // Only reachable within the cluster (not exposed via OpenShift Route).
  // Skips JWT auth — internal trust between pods.
  app.get('/internal/terminal/:sessionId', { websocket: true }, async (socket, _req) => {
    const sessionId = (_req.params as { sessionId: string }).sessionId
    const assignment = await getSessionAssignment(sessionId)
    const userId = assignment?.userId ?? 'unknown'
    attachLocal(socket as unknown as WebSocket, sessionId, userId)
  })
}
