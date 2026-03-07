import { useASTStore } from '../stores/ast-store'
import type { ASTItemResult } from '../ast/types'

export interface LivePolicy {
  id: string
  policyNumber: string
  status: string
  durationMs: number
  error: string | null
  data: Record<string, unknown> | null
}

function mapItemToPolicy(item: ASTItemResult): LivePolicy {
  return {
    id: item.id,
    policyNumber: item.policyNumber,
    status: item.status,
    durationMs: item.durationMs,
    error: item.error ?? null,
    data: item.data ?? null,
  }
}

export interface ExecutionStreamResult {
  livePolicies: LivePolicy[]
  completed: boolean
  completedStatus: string | null
  progress: { current: number; total: number; message: string } | null
}

/**
 * Reads live execution data from the AST store (fed by ASTEventBridge → WS).
 * Returns null when there's no active session tab for this execution.
 */
export function useExecutionStream(
  _executionId: string | null,
  sessionId: string | null,
  isRunning: boolean,
): ExecutionStreamResult | null {
  const itemResults = useASTStore((s) =>
    sessionId ? (s.tabs[sessionId]?.itemResults ?? null) : null,
  )
  const progress = useASTStore((s) =>
    sessionId ? (s.tabs[sessionId]?.progress ?? null) : null,
  )
  const astStatus = useASTStore((s) =>
    sessionId ? (s.tabs[sessionId]?.status ?? null) : null,
  )

  if (!sessionId || !isRunning || !itemResults) return null

  const completed =
    astStatus === 'completed' || astStatus === 'failed' || astStatus === 'cancelled'

  return {
    livePolicies: itemResults.map(mapItemToPolicy),
    completed,
    completedStatus: completed ? astStatus : null,
    progress: progress
      ? { current: progress.current, total: progress.total, message: progress.message ?? '' }
      : null,
  }
}
