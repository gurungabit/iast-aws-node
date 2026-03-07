import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { History, FileText } from 'lucide-react'
import { useApiQuery } from '../../hooks/useApi'
import { cn, formatTime, formatDuration } from '../../utils'
import { DatePicker } from '../../components/ui/DatePicker'

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
      <div className="w-96 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 flex flex-col">
        <div className="p-3">
          <DatePicker value={date} onChange={setDate} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {executions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-gray-100 dark:bg-zinc-800 p-3 mb-3">
                <History className="h-6 w-6 text-gray-400 dark:text-zinc-500" />
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">No executions found</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">Try a different date</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 px-2 pb-2">
              {executions.map((exec) => (
                <button
                  key={exec.id}
                  onClick={() => setSelectedExecution(exec.id)}
                  className={cn(
                    'w-full rounded-lg p-3 text-left transition-colors cursor-pointer',
                    selectedExecution === exec.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800'
                      : 'hover:bg-gray-100 dark:hover:bg-zinc-800/50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-900 dark:text-zinc-100">
                      {exec.astName}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        exec.status === 'completed' &&
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                        exec.status === 'failed' &&
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                        exec.status === 'cancelled' &&
                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                        exec.status === 'running' &&
                          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                      )}
                    >
                      {exec.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-500 dark:text-zinc-500">
                    <span>{formatTime(exec.startedAt)}</span>
                    <span>{exec.totalPolicies} policies</span>
                    <span className="text-green-600 dark:text-green-500">
                      {exec.successCount}ok
                    </span>
                    {exec.failureCount > 0 && (
                      <span className="text-red-600 dark:text-red-500">
                        {exec.failureCount}fail
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Policy results */}
      <div className="flex-1 flex flex-col">
        {selectedExecution ? (
          <PolicyList policies={policies} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="rounded-full bg-gray-100 dark:bg-zinc-800 p-4 mb-4 mx-auto w-fit">
                <FileText className="h-8 w-8 text-gray-400 dark:text-zinc-500" />
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                Select an execution to view policies
              </p>
            </div>
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
    estimateSize: () => 36,
    overscan: 20,
  })

  return (
    <>
      <div className="px-4 py-2.5">
        <span className="text-xs text-gray-500 dark:text-zinc-400">{policies.length} policies</span>
      </div>
      <div ref={parentRef} className="flex-1 overflow-y-auto px-2">
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
        >
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
                className={cn(
                  'flex items-center justify-between rounded-md px-3 text-xs',
                  virtualRow.index % 2 === 0 ? 'bg-gray-50/50 dark:bg-zinc-800/30' : '',
                )}
              >
                <span className="font-mono text-gray-700 dark:text-zinc-300">
                  {policy.policyNumber}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 dark:text-zinc-500">
                    {formatDuration(policy.durationMs)}
                  </span>
                  {policy.error && (
                    <span className="max-w-[200px] truncate text-red-500 dark:text-red-400">
                      {policy.error}
                    </span>
                  )}
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium',
                      policy.status === 'success' &&
                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                      policy.status === 'failure' &&
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                      policy.status === 'error' &&
                        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                      policy.status === 'skipped' &&
                        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
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
