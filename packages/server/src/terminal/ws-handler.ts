import type { FastifyInstance } from 'fastify'
import { terminalManager } from './manager.js'
import { verifyWsToken } from '../auth/ws-auth.js'
import { executionService } from '../services/execution.js'
import type { WorkerToMainMessage } from './worker-messages.js'

export async function terminalWsRoutes(app: FastifyInstance) {
  app.get(
    '/api/terminal/:sessionId',
    { websocket: true },
    async (socket, req) => {
      const sessionId = (req.params as { sessionId: string }).sessionId

      // Authenticate via query param token
      const url = new URL(req.url, `http://${req.headers.host}`)
      const token = url.searchParams.get('token') ?? undefined
      const user = await verifyWsToken(token)

      if (!user) {
        socket.close(4001, 'Unauthorized')
        return
      }

      const worker = terminalManager.getOrCreateWorker(sessionId)
      terminalManager.attachWebSocket(sessionId, socket)

      // Browser → Worker
      socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
        try {
          const msg = JSON.parse(String(data))
          worker.postMessage(msg)
        } catch {
          // ignore malformed messages
        }
      })

      // Worker → Browser
      const onWorkerMessage = (msg: WorkerToMainMessage) => {
        try {
          // Persist policy results to DB
          if (msg.type === 'ast.item_result_batch') {
            executionService
              .batchInsertPolicies(msg.executionId, msg.items)
              .catch((err) => console.error('Failed to persist policies:', err))
          }

          if (socket.readyState === 1) {
            socket.send(JSON.stringify(msg))
          }
        } catch {
          // ignore send errors
        }
      }

      worker.on('message', onWorkerMessage)

      socket.on('close', () => {
        worker.off('message', onWorkerMessage)
        terminalManager.detachWebSocket(sessionId)
      })

      socket.on('error', () => {
        worker.off('message', onWorkerMessage)
        terminalManager.detachWebSocket(sessionId)
      })
    },
  )
}
