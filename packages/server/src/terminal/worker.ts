import { parentPort, workerData } from 'worker_threads'
import { Tnz, Ati } from 'tnz3270-node'
import { renderAnsiScreen } from './renderer.js'
import type { MainToWorkerMessage, WorkerToMainMessage, ScreenMeta } from './worker-messages.js'

if (!parentPort) throw new Error('worker.ts must be run as a Worker thread')

const port = parentPort
const { tn3270Host, tn3270Port, tn3270Secure } = workerData as {
  sessionId: string
  tn3270Host: string
  tn3270Port: number
  tn3270Secure: boolean
}

let tnz: Tnz | null = null
let ati: Ati | null = null
const sessionName = 'WEB'

// AST runner import (lazy)
let astRunner: typeof import('../ast/runner.js') | null = null

function send(msg: WorkerToMainMessage) {
  port.postMessage(msg)
}

function updateScreen() {
  if (!tnz) return
  const ansi = renderAnsiScreen(tnz)
  const meta: ScreenMeta = {
    cursorRow: Math.floor(tnz.curadd / tnz.maxCol) + 1,
    cursorCol: (tnz.curadd % tnz.maxCol) + 1,
    locked: tnz.pwait || tnz.systemLockWait,
    rows: tnz.maxRow,
    cols: tnz.maxCol,
  }
  send({ type: 'screen', ansi, meta })
}

const ALLOWED_KEYS = new Set([
  'enter',
  'clear',
  'attn',
  'keyCurUp',
  'keyCurDown',
  'keyCurLeft',
  'keyCurRight',
  'keyTab',
  'keyBacktab',
  'keyHome',
  'keyEnd',
  'keyBackspace',
  'keyDelete',
  'pf1',
  'pf2',
  'pf3',
  'pf4',
  'pf5',
  'pf6',
  'pf7',
  'pf8',
  'pf9',
  'pf10',
  'pf11',
  'pf12',
  'pf13',
  'pf14',
  'pf15',
  'pf16',
  'pf17',
  'pf18',
  'pf19',
  'pf20',
  'pf21',
  'pf22',
  'pf23',
  'pf24',
  'pa1',
  'pa2',
  'pa3',
])

port.on('message', async (msg: MainToWorkerMessage) => {
  try {
    switch (msg.type) {
      case 'connect': {
        if (tnz) {
          try {
            tnz.shutdown()
          } catch {
            // ignore
          }
        }

        tnz = new Tnz(sessionName, {
          terminalType: 'IBM-3278-4-E',
          useTn3270e: true,
          amaxRow: 43,
          onScreenUpdate: updateScreen,
        })

        ati = new Ati()
        ati.registerSession(sessionName, tnz)

        tnz.on('close', () => {
          send({ type: 'disconnected' })
        })

        await tnz.connect(tn3270Host, tn3270Port, {
          secure: tn3270Secure,
          verifyCert: false,
        })

        send({ type: 'connected' })
        updateScreen()
        break
      }

      case 'disconnect': {
        if (tnz) {
          try {
            tnz.shutdown()
          } catch {
            // ignore
          }
          tnz = null
          ati = null
        }
        send({ type: 'disconnected' })
        break
      }

      case 'key': {
        if (!tnz) return
        if (msg.key === 'reset') {
          tnz.systemLockWait = false
          tnz.pwait = false
          updateScreen()
          return
        }
        if (tnz.pwait || tnz.systemLockWait) return
        if (ALLOWED_KEYS.has(msg.key)) {
          const method = tnz[msg.key as keyof Tnz]
          if (typeof method === 'function') {
            ;(method as () => void).call(tnz)
          }
          updateScreen()
        }
        break
      }

      case 'data': {
        if (!tnz || tnz.pwait || tnz.systemLockWait) return
        tnz.keyData(msg.text)
        updateScreen()
        break
      }

      case 'cursor': {
        if (!tnz || tnz.pwait || tnz.systemLockWait) return
        try {
          tnz.setCursorPosition(msg.row, msg.col)
          updateScreen()
        } catch {
          // ignore out of bounds
        }
        break
      }

      case 'ast.run': {
        if (!ati) {
          send({ type: 'error', message: 'Not connected' })
          return
        }
        if (!astRunner) {
          astRunner = await import('../ast/runner.js')
        }
        astRunner.runAST(ati, msg.astName, msg.params, msg.executionId, port)
        break
      }

      case 'ast.control': {
        if (!astRunner) return
        astRunner.controlAST(msg.action)
        break
      }
    }
  } catch (err) {
    send({ type: 'error', message: String(err) })
  }
})
