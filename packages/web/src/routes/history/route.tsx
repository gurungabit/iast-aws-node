import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useApiQuery } from '../../hooks/useApi'
import { cn, formatTime, formatDuration } from '../../utils'
import { Input } from '../../components/ui/Input'

export const Route = createFileRoute('/history')({
  component: HistoryPage,
})

interface ExecutionDto {
  id: string
  sessionId: string
  astName: string
  status: string
  hostUser: string | null
  executionDate: string
  startedAt: string
  completedAt: string | null
  totalPolicies: number
  successCount: number
  failureCount: number
  errorCount: number
}

interface PolicyDto {
  id: string
  policyNumber: string
  status: string
  durationMs: number
  error: string | null
  data: unknown
}

function HistoryPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null)

  const { data: executions = [] } = useApiQuery<ExecutionDto[]>(
    ['history', date],
    `/history?date=${date}`,
  )

  const { data: policies = [] } = useApiQuery<PolicyDto[]>(
    ['policies', selectedExecution],
    `/history/${selectedExecution}/policies`,
    !!selectedExecution,
  )

  return (
    <div className="flex h-full">
      {/* Execution list */}
      <div className="w-96 border-r border-gray-800 flex flex-col">
        <div className="border-b border-gray-800 p-3">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {executions.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-500">No executions found</p>
          ) : (
            executions.map((exec) => (
              <button
                key={exec.id}
                onClick={() => setSelectedExecution(exec.id)}
                className={cn(
                  'w-full border-b border-gray-800/50 p-3 text-left hover:bg-gray-900',
                  selectedExecution === exec.id && 'bg-gray-900',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">{exec.astName}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                      exec.status === 'completed' && 'bg-green-900/30 text-green-400',
                      exec.status === 'failed' && 'bg-red-900/30 text-red-400',
                      exec.status === 'cancelled' && 'bg-yellow-900/30 text-yellow-400',
                      exec.status === 'running' && 'bg-blue-900/30 text-blue-400',
                    )}
                  >
                    {exec.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-500">
                  <span>{formatTime(exec.startedAt)}</span>
                  <span>{exec.totalPolicies} policies</span>
                  <span className="text-green-500">{exec.successCount}ok</span>
                  {exec.failureCount > 0 && <span className="text-red-500">{exec.failureCount}fail</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Policy results */}
      <div className="flex-1 flex flex-col">
        {selectedExecution ? (
          <PolicyList policies={policies} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-gray-500">Select an execution to view policies</p>
          </div>
        )}
      </div>
    </div>
  )
}

function PolicyList({ policies }: { policies: PolicyDto[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: policies.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 20,
  })

  return (
    <>
      <div className="border-b border-gray-800 px-4 py-2">
        <span className="text-xs text-gray-400">{policies.length} policies</span>
      </div>
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const policy = policies[virtualRow.index]
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="flex items-center justify-between border-b border-gray-800/30 px-4 text-xs"
              >
                <span className="font-mono text-gray-300">{policy.policyNumber}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{formatDuration(policy.durationMs)}</span>
                  {policy.error && <span className="max-w-[200px] truncate text-red-400">{policy.error}</span>}
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                      policy.status === 'success' && 'bg-green-900/30 text-green-400',
                      policy.status === 'failure' && 'bg-red-900/30 text-red-400',
                      policy.status === 'error' && 'bg-orange-900/30 text-orange-400',
                      policy.status === 'skipped' && 'bg-gray-800 text-gray-400',
                    )}
                  >
                    {policy.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
