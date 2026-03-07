import { useEffect, useState, useRef } from 'react'
import { useSessionStore } from '../stores/session-store'
import type { ServerMessage, ASTItemResult } from '../services/websocket'

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

interface StreamState {
  execId: string | null
  policies: LivePolicy[]
  completed: boolean
  completedStatus: string | null
  progress: { current: number; total: number; message: string } | null
}

const INITIAL_STATE: StreamState = {
  execId: null,
  policies: [],
  completed: false,
  completedStatus: null,
  progress: null,
}

// Throttle UI updates to max ~4/sec to avoid freezing on high-throughput ASTs
const THROTTLE_MS = 250

/**
 * Subscribes to a session's WebSocket to stream live execution updates.
 * Returns null if the session has no active WS connection (caller should fallback to polling).
 */
export function useExecutionStream(
  executionId: string | null,
  sessionId: string | null,
  isRunning: boolean,
): ExecutionStreamResult | null {
  // Targeted selector: only re-render when the WS instance itself changes,
  // not on every screen update or other tab mutations.
  const ws = useSessionStore((s) =>
    sessionId ? (s.tabs.get(sessionId)?.ws ?? null) : null,
  )
  const hasWs = ws !== null && isRunning && executionId !== null

  const [state, setState] = useState<StreamState>(INITIAL_STATE)
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Subscribe to WS messages with throttled state updates
  useEffect(() => {
    if (!ws || !executionId || !isRunning) return

    const policyMap = new Map<string, LivePolicy>()
    let dirty = false
    let pendingProgress: { current: number; total: number; message: string } | null = null
    let pendingCompleted = false
    let pendingCompletedStatus: string | null = null

    const flushToState = () => {
      flushTimerRef.current = null
      if (!dirty && !pendingProgress && !pendingCompleted) return

      setState((prev) => {
        const next: StreamState = {
          ...prev,
          execId: executionId,
        }
        if (dirty) {
          next.policies = Array.from(policyMap.values())
          dirty = false
        }
        if (pendingProgress) {
          next.progress = pendingProgress
          pendingProgress = null
        }
        if (pendingCompleted) {
          next.completed = true
          next.completedStatus = pendingCompletedStatus
        }
        return next
      })
    }

    const scheduleFlush = () => {
      if (flushTimerRef.current === null) {
        flushTimerRef.current = setTimeout(flushToState, THROTTLE_MS)
      }
    }

    const cleanup = ws.onMessage((msg: ServerMessage) => {
      if (msg.type === 'ast.item_result_batch' && msg.executionId === executionId) {
        for (const item of msg.items) {
          policyMap.set(item.id, mapItemToPolicy(item))
        }
        dirty = true
        scheduleFlush()
      } else if (msg.type === 'ast.complete' && msg.executionId === executionId) {
        pendingCompleted = true
        pendingCompletedStatus = msg.status
        // Flush immediately on completion
        if (flushTimerRef.current !== null) {
          clearTimeout(flushTimerRef.current)
        }
        flushToState()
      } else if (msg.type === 'ast.progress') {
        pendingProgress = msg.progress
        scheduleFlush()
      }
    })

    return () => {
      cleanup()
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
    }
  }, [ws, executionId, isRunning])

  if (!hasWs) return null

  // Only return data if it matches the current execution
  if (state.execId !== executionId) {
    return { livePolicies: [], completed: false, completedStatus: null, progress: null }
  }

  return {
    livePolicies: state.policies,
    completed: state.completed,
    completedStatus: state.completedStatus,
    progress: state.progress,
  }
}
