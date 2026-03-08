import type { ASTItemResult, ASTName, ASTProgress, ASTStatus } from './ast.js'
import type { ScreenMeta } from './messages.js'

// Main thread → Worker thread messages
export type MainToWorkerMessage =
  | { type: 'connect'; host: string; port: number; options?: Record<string, unknown> }
  | { type: 'disconnect' }
  | { type: 'key'; key: string }
  | { type: 'data'; text: string }
  | { type: 'cursor'; row: number; col: number }
  | {
      type: 'ast.run'
      astName: ASTName
      params: Record<string, unknown>
      executionId: string
      completedPolicies?: string[]
    }
  | { type: 'ast.control'; action: 'pause' | 'resume' | 'cancel' }

// Worker thread → Main thread messages
export type WorkerToMainMessage =
  | { type: 'connected' }
  | { type: 'disconnected'; reason?: string }
  | { type: 'screen'; ansi: string; meta: ScreenMeta }
  | { type: 'ast.status'; status: ASTStatus; astName: ASTName; executionId: string }
  | { type: 'ast.progress'; progress: ASTProgress }
  | { type: 'ast.item_result_batch'; executionId: string; items: ASTItemResult[] }
  | { type: 'ast.complete'; status: ASTStatus; executionId: string; error?: string }
  | { type: 'error'; message: string }
