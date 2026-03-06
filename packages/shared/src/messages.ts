import type { ASTItemResult, ASTName, ASTProgress, ASTStatus } from './ast.js'

// Browser → Server WebSocket messages
export type ClientMessage =
  | { type: 'connect'; host: string; port: number; options?: Record<string, unknown> }
  | { type: 'disconnect' }
  | { type: 'key'; key: string }
  | { type: 'data'; text: string }
  | { type: 'cursor'; row: number; col: number }
  | { type: 'ast.run'; astName: ASTName; params: Record<string, unknown>; configId?: string }
  | { type: 'ast.control'; action: 'pause' | 'resume' | 'cancel' }

// Server → Browser WebSocket messages
export type ServerMessage =
  | { type: 'connected' }
  | { type: 'disconnected'; reason?: string }
  | { type: 'screen'; ansi: string; meta: ScreenMeta }
  | { type: 'ast.status'; status: ASTStatus; astName: ASTName; executionId: string }
  | { type: 'ast.progress'; progress: ASTProgress }
  | { type: 'ast.item_result_batch'; executionId: string; items: ASTItemResult[] }
  | { type: 'ast.complete'; status: ASTStatus; executionId: string; error?: string }
  | { type: 'error'; message: string; code?: string }

export interface ScreenMeta {
  cursorRow: number
  cursorCol: number
  locked: boolean
  rows: number
  cols: number
}
