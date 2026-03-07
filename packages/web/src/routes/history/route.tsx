import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X, Clock, Loader2, Pause, Ban, Circle, ChevronRight } from 'lucide-react'
import { apiGet } from '../../services/api'
import { cn, formatDuration } from '../../utils'
import { DatePicker } from '../../components/ui/DatePicker'
import { useExecutionStream } from '../../hooks/useExecutionStream'

export const Route = createFileRoute('/history')({
  component: HistoryPage,
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExecutionStatus = 'running' | 'completed' | 'success' | 'failed' | 'paused' | 'cancelled'
type TabFilter = 'all' | ExecutionStatus

interface ExecutionDto {
  id: string
  sessionId: string
  astName: string
  status: string
  hostUser: string | null
  runId: string | null
  launcherName: string | null
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
  data: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TABS: { id: TabFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
  { id: 'paused', label: 'Paused' },
  { id: 'cancelled', label: 'Cancelled' },
]

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300',
  error: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  skipped: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
}

// ---------------------------------------------------------------------------
// StatusIcon
// ---------------------------------------------------------------------------

function StatusIcon({ status, className = 'w-3.5 h-3.5' }: { status: string; className?: string }) {
  switch (status) {
    case 'running':
      return <Loader2 className={`${className} animate-spin`} />
    case 'success':
    case 'completed':
      return <Check className={className} />
    case 'failed':
    case 'error':
      return <X className={className} />
    case 'paused':
      return <Pause className={className} />
    case 'cancelled':
      return <Ban className={className} />
    case 'skipped':
      return <Circle className={className} />
    default:
      return <Circle className={className} />
  }
}

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------

function Breadcrumb({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          {idx > 0 && <span className="text-gray-400 dark:text-zinc-600">/</span>}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-gray-700 dark:text-zinc-300 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EmptyPanel
// ---------------------------------------------------------------------------

function EmptyPanel({ message, subtitle }: { message: string; subtitle?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-zinc-600">
      <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
      <p className="text-sm">{message}</p>
      {subtitle && <p className="text-xs mt-1">{subtitle}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TabBar
// ---------------------------------------------------------------------------

function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabFilter
  onTabChange: (tab: TabFilter) => void
}) {
  return (
    <div className="flex flex-wrap gap-1 p-1 bg-gray-100 dark:bg-zinc-800/50 rounded-lg">
      {STATUS_TABS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={cn(
            'cursor-pointer px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap',
            activeTab === id
              ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm'
              : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExecutionListItem
// ---------------------------------------------------------------------------

function ExecutionListItem({
  execution,
  isSelected,
  onClick,
  compact = false,
}: {
  execution: ExecutionDto
  isSelected: boolean
  onClick: () => void
  compact?: boolean
}) {
  const startTime = new Date(execution.startedAt)
  const fmtTime = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const duration = execution.completedAt
    ? new Date(execution.completedAt).getTime() - startTime.getTime()
    : null

  return (
    <button
      onClick={onClick}
      className={cn(
        'cursor-pointer w-full text-left rounded-lg transition-all duration-150 border',
        compact ? 'p-2' : 'p-3',
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-300 dark:ring-blue-700'
          : 'bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 border-gray-200 dark:border-zinc-800',
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            'font-medium text-gray-900 dark:text-zinc-100 truncate',
            compact ? 'text-xs' : 'text-sm',
          )}
        >
          {execution.astName}
        </span>
        <span
          className={cn(
            'px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1',
            STATUS_COLORS[execution.status] ?? STATUS_COLORS.cancelled,
          )}
        >
          <StatusIcon status={execution.status} />
          {execution.status}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-500">
        <span>{fmtTime(startTime)}</span>
        {duration !== null && (
          <span className="flex items-center gap-0.5">
            <Clock className="w-3 h-3" />
            {formatDuration(duration)}
          </span>
        )}
        <span>{execution.totalPolicies} policies</span>
        {execution.failureCount > 0 && (
          <span className="text-red-500 flex items-center gap-0.5">
            <X className="w-3 h-3" />
            {execution.failureCount}
          </span>
        )}
        {execution.successCount > 0 && (
          <span className="text-emerald-500 flex items-center gap-0.5">
            <Check className="w-3 h-3" />
            {execution.successCount}
          </span>
        )}
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// RunGroupRow (collapsible parent for AutoLauncher executions)
// ---------------------------------------------------------------------------

interface RunGroup {
  runId: string
  launcherName: string
  executions: ExecutionDto[]
}

function RunGroupRow({
  group,
  selectedExecutionId,
  onSelectExecution,
}: {
  group: RunGroup
  selectedExecutionId: string | null
  onSelectExecution: (e: ExecutionDto) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  const allCompleted = group.executions.every(
    (e) => e.status === 'completed' || e.status === 'success',
  )
  const anyFailed = group.executions.some((e) => e.status === 'failed')
  const anyRunning = group.executions.some((e) => e.status === 'running')
  const groupStatus = anyRunning
    ? 'running'
    : anyFailed
      ? 'failed'
      : allCompleted
        ? 'completed'
        : 'running'

  const totalPolicies = group.executions.reduce((sum, e) => sum + e.totalPolicies, 0)
  const totalSuccess = group.executions.reduce((sum, e) => sum + e.successCount, 0)
  const totalFailed = group.executions.reduce((sum, e) => sum + e.failureCount, 0)

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className={cn(
          'cursor-pointer w-full text-left p-3 rounded-lg transition-all duration-150 border',
          'bg-gray-50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800 border-gray-200 dark:border-zinc-800',
        )}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ChevronRight
              className={cn(
                'w-3.5 h-3.5 text-gray-500 dark:text-zinc-400 transition-transform',
                !collapsed && 'rotate-90',
              )}
            />
            <span className="font-medium text-gray-900 dark:text-zinc-100 text-sm truncate">
              {group.launcherName}
            </span>
            <span className="text-xs text-gray-500 dark:text-zinc-500">
              ({group.executions.length} steps)
            </span>
          </div>
          <span
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1',
              STATUS_COLORS[groupStatus] ?? STATUS_COLORS.cancelled,
            )}
          >
            <StatusIcon status={groupStatus} />
            {groupStatus}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-500 pl-5.5">
          <span>{totalPolicies} policies</span>
          {totalFailed > 0 && (
            <span className="text-red-500 flex items-center gap-0.5">
              <X className="w-3 h-3" />
              {totalFailed}
            </span>
          )}
          {totalSuccess > 0 && (
            <span className="text-emerald-500 flex items-center gap-0.5">
              <Check className="w-3 h-3" />
              {totalSuccess}
            </span>
          )}
        </div>
      </button>
      {!collapsed && (
        <div className="pl-4 space-y-1">
          {group.executions.map((exec) => (
            <ExecutionListItem
              key={exec.id}
              execution={exec}
              isSelected={selectedExecutionId === exec.id}
              onClick={() => onSelectExecution(exec)}
              compact
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PoliciesList (Panel 2)
// ---------------------------------------------------------------------------

function PoliciesList({
  execution,
  policies,
  selectedPolicy,
  onSelectPolicy,
  onBack,
  isLoading,
}: {
  execution: ExecutionDto
  policies: PolicyDto[]
  selectedPolicy: PolicyDto | null
  onSelectPolicy: (p: PolicyDto) => void
  onBack: () => void
  isLoading: boolean
}) {
  const counts = useMemo(
    () => ({
      success: policies.filter((p) => p.status === 'success').length,
      failed: policies.filter((p) => p.status === 'failed' || p.status === 'error').length,
      skipped: policies.filter((p) => p.status === 'skipped').length,
    }),
    [policies],
  )

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
        <Breadcrumb
          items={[{ label: 'Executions', onClick: onBack }, { label: execution.astName }]}
        />

        <div className="mt-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Policies</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-500">
              {execution.hostUser || 'unknown'} &bull;{' '}
              {new Date(execution.startedAt).toLocaleString()}
            </p>
          </div>
          <span
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full flex items-center gap-1.5',
              STATUS_COLORS[execution.status] ?? STATUS_COLORS.cancelled,
            )}
          >
            <StatusIcon status={execution.status} />
            {execution.status}
          </span>
        </div>

        {/* Stats */}
        <div className="mt-3 flex items-center gap-4 text-xs">
          <span className="text-gray-600 dark:text-zinc-400">
            {policies.length}/{execution.totalPolicies || '?'} policies
          </span>
          {counts.success > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <Check className="w-3 h-3" /> {counts.success}
            </span>
          )}
          {counts.failed > 0 && (
            <span className="text-red-600 dark:text-red-400 flex items-center gap-0.5">
              <X className="w-3 h-3" /> {counts.failed}
            </span>
          )}
          {counts.skipped > 0 && (
            <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-0.5">
              <Circle className="w-3 h-3" /> {counts.skipped}
            </span>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {isLoading && policies.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-gray-200 dark:border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : policies.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-zinc-500 text-sm">
            No policies found
          </div>
        ) : (
          policies.map((policy) => (
            <button
              key={policy.id}
              onClick={() => onSelectPolicy(policy)}
              className={cn(
                'cursor-pointer w-full text-left p-3 rounded-lg transition-all duration-150 border',
                selectedPolicy?.id === policy.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-300 dark:ring-blue-700'
                  : 'bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 border-gray-200 dark:border-zinc-800',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-gray-900 dark:text-zinc-100">
                  {policy.policyNumber}
                </span>
                <span
                  className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1',
                    STATUS_COLORS[policy.status] ?? STATUS_COLORS.cancelled,
                  )}
                >
                  <StatusIcon status={policy.status} />
                  {policy.status}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-500">
                <span>{(policy.durationMs / 1000).toFixed(1)}s</span>
                {policy.error && (
                  <span className="text-red-500 truncate max-w-[200px]">{policy.error}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PolicyDetail (Panel 3)
// ---------------------------------------------------------------------------

function PolicyDetail({
  policy,
  execution,
  onBack,
}: {
  policy: PolicyDto
  execution: ExecutionDto
  onBack: () => void
}) {
  const data = policy.data as Record<string, unknown> | null

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
        <Breadcrumb
          items={[
            { label: 'Executions', onClick: onBack },
            { label: execution.astName, onClick: onBack },
            { label: policy.policyNumber },
          ]}
        />

        <div className="mt-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold font-mono text-gray-900 dark:text-zinc-100">
            {policy.policyNumber}
          </h2>
          <span
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full flex items-center gap-1',
              STATUS_COLORS[policy.status] ?? STATUS_COLORS.cancelled,
            )}
          >
            <StatusIcon status={policy.status} />
            {policy.status}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
            <div className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Duration</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
              {(policy.durationMs / 1000).toFixed(2)}s
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
            <div className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Status</div>
            <div
              className={cn(
                'text-lg font-semibold',
                policy.status === 'success' && 'text-emerald-600 dark:text-emerald-400',
                policy.status === 'failed' && 'text-red-600 dark:text-red-400',
                policy.status === 'error' && 'text-red-600 dark:text-red-400',
                policy.status === 'skipped' && 'text-yellow-600 dark:text-yellow-400',
              )}
            >
              {policy.status.charAt(0).toUpperCase() + policy.status.slice(1)}
            </div>
          </div>
        </div>

        {/* Error */}
        {policy.error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="text-xs font-medium text-red-700 dark:text-red-400 mb-2">Error</div>
            <pre className="text-sm text-red-600 dark:text-red-300 whitespace-pre-wrap font-mono">
              {policy.error}
            </pre>
          </div>
        )}

        {/* Error Screen */}
        {policy.status === 'failed' && typeof data?.errorScreen === 'string' && (
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-700">
            <div className="text-xs font-medium text-zinc-400 mb-2">Screen at Time of Error</div>
            <pre className="text-xs text-green-400 whitespace-pre font-mono overflow-x-auto leading-tight">
              {data.errorScreen}
            </pre>
          </div>
        )}

        {/* Screenshots */}
        {Array.isArray(data?.screenshots) && (data.screenshots as unknown[]).length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-700 dark:text-zinc-300">
              Screenshots ({(data.screenshots as unknown[]).length})
            </div>
            {(data.screenshots as { label: string; screen: string }[]).map((screenshot, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-zinc-900 border border-zinc-700">
                <div className="text-xs font-medium text-zinc-400 mb-2">
                  {screenshot.label || `Screenshot ${idx + 1}`}
                </div>
                <pre className="text-xs text-green-400 whitespace-pre font-mono overflow-x-auto leading-tight">
                  {screenshot.screen}
                </pre>
              </div>
            ))}
          </div>
        )}

        {/* Policy Data */}
        {data && Object.keys(data).length > 0 && (
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
            <div className="text-xs font-medium text-gray-700 dark:text-zinc-300 mb-2">
              Policy Data
            </div>
            <pre className="text-xs text-gray-600 dark:text-zinc-400 whitespace-pre-wrap font-mono overflow-x-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function HistoryPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedExecution, setSelectedExecution] = useState<ExecutionDto | null>(null)
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyDto | null>(null)

  const { data: executions = [], isLoading: isLoadingExecs } = useQuery({
    queryKey: ['history', date],
    queryFn: () => apiGet<ExecutionDto[]>(`/history?date=${date}`),
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.some((e) => e.status === 'running')) return 3000
      return false
    },
  })

  const isSelectedRunning = selectedExecution
    ? executions.find((e) => e.id === selectedExecution.id)?.status === 'running'
    : false

  // Live WS stream for the selected execution
  const stream = useExecutionStream(
    selectedExecution?.id ?? null,
    selectedExecution?.sessionId ?? null,
    isSelectedRunning,
  )
  const hasLiveStream = stream !== null

  // Fetch from DB: initial load + refetch on completion (no polling when WS is active)
  const { data: dbPolicies = [], isLoading: isLoadingPolicies } = useQuery({
    queryKey: ['policies', selectedExecution?.id],
    queryFn: () => apiGet<PolicyDto[]>(`/history/${selectedExecution?.id}/policies?limit=10000`),
    enabled: !!selectedExecution,
    refetchInterval: isSelectedRunning && !hasLiveStream ? 2000 : false,
  })

  // When stream completes, refetch from DB to get authoritative data
  const streamCompleted = stream?.completed ?? false
  const selectedExecutionId = selectedExecution?.id ?? null
  useEffect(() => {
    if (streamCompleted) {
      void queryClient.invalidateQueries({ queryKey: ['policies', selectedExecutionId] })
      void queryClient.invalidateQueries({ queryKey: ['history', date] })
    }
  }, [streamCompleted, selectedExecutionId, date, queryClient])

  // Merge DB policies with live WS items (dedup by id, WS items take precedence)
  const streamPolicies = stream?.livePolicies
  const policies = useMemo(() => {
    if (!streamPolicies?.length) return dbPolicies
    const byId = new Map(dbPolicies.map((p) => [p.id, p]))
    for (const item of streamPolicies) {
      byId.set(item.id, item)
    }
    return Array.from(byId.values())
  }, [dbPolicies, streamPolicies])

  // Filter executions by tab
  const filteredExecutions = useMemo(() => {
    if (activeTab === 'all') return executions
    return executions.filter((e) => e.status === activeTab)
  }, [executions, activeTab])

  // Group executions: standalone items + RunGroup items
  const groupedItems = useMemo(() => {
    const items: Array<
      { type: 'single'; execution: ExecutionDto } | { type: 'group'; group: RunGroup }
    > = []
    const runMap = new Map<string, ExecutionDto[]>()

    for (const exec of filteredExecutions) {
      if (exec.runId) {
        const arr = runMap.get(exec.runId) ?? []
        arr.push(exec)
        runMap.set(exec.runId, arr)
      } else {
        items.push({ type: 'single', execution: exec })
      }
    }

    // Insert run groups at the position of their first execution
    const runGroupPositions = new Map<string, number>()
    for (let i = 0; i < filteredExecutions.length; i++) {
      const runId = filteredExecutions[i].runId
      if (runId && !runGroupPositions.has(runId)) {
        runGroupPositions.set(runId, i)
      }
    }

    // Rebuild items in correct order
    const orderedItems: typeof items = []
    const processedRunIds = new Set<string>()
    for (const exec of filteredExecutions) {
      if (exec.runId) {
        if (!processedRunIds.has(exec.runId)) {
          processedRunIds.add(exec.runId)
          const groupExecs = runMap.get(exec.runId)!
          orderedItems.push({
            type: 'group',
            group: {
              runId: exec.runId,
              launcherName: exec.launcherName ?? 'AutoLauncher Run',
              executions: groupExecs,
            },
          })
        }
      } else {
        orderedItems.push({ type: 'single', execution: exec })
      }
    }

    return orderedItems
  }, [filteredExecutions])

  // Keep selectedExecution in sync with refreshed data
  const liveSelectedExecution = useMemo(() => {
    if (!selectedExecution) return null
    return executions.find((e) => e.id === selectedExecution.id) ?? selectedExecution
  }, [executions, selectedExecution])

  const handleSelectExecution = (execution: ExecutionDto) => {
    setSelectedExecution(execution)
    setSelectedPolicy(null)
  }

  const handleBackToList = () => {
    setSelectedExecution(null)
    setSelectedPolicy(null)
  }

  const handleBackToPolicies = () => {
    setSelectedPolicy(null)
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Panel 1: Executions List */}
      <div className="w-[480px] flex-shrink-0 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col">
        {/* Controls */}
        <div className="p-3 border-b border-gray-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">History</h1>
            <div className="w-44">
              <DatePicker value={date} onChange={setDate} align="right" />
            </div>
          </div>
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {isLoadingExecs && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-gray-200 dark:border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}

          {!isLoadingExecs && filteredExecutions.length === 0 && (
            <EmptyPanel
              message="No executions found for this date"
              subtitle="Try selecting a different date above"
            />
          )}

          {groupedItems.map((item) =>
            item.type === 'group' ? (
              <RunGroupRow
                key={item.group.runId}
                group={item.group}
                selectedExecutionId={selectedExecution?.id ?? null}
                onSelectExecution={handleSelectExecution}
              />
            ) : (
              <ExecutionListItem
                key={item.execution.id}
                execution={item.execution}
                isSelected={selectedExecution?.id === item.execution.id}
                onClick={() => handleSelectExecution(item.execution)}
              />
            ),
          )}
        </div>
      </div>

      {/* Panel 2: Policies List */}
      <div className="w-[480px] flex-shrink-0 bg-gray-50 dark:bg-zinc-900/50 border-r border-gray-200 dark:border-zinc-800">
        {liveSelectedExecution ? (
          <PoliciesList
            execution={liveSelectedExecution}
            policies={policies}
            selectedPolicy={selectedPolicy}
            onSelectPolicy={setSelectedPolicy}
            onBack={handleBackToList}
            isLoading={isLoadingPolicies}
          />
        ) : (
          <EmptyPanel message="Select an execution to view policies" />
        )}
      </div>

      {/* Panel 3: Policy Detail */}
      <div className="flex-1 bg-white dark:bg-zinc-900">
        {selectedPolicy && liveSelectedExecution ? (
          <PolicyDetail
            policy={selectedPolicy}
            execution={liveSelectedExecution}
            onBack={handleBackToPolicies}
          />
        ) : liveSelectedExecution ? (
          <EmptyPanel message="Select a policy to view details" />
        ) : (
          <EmptyPanel message="Select an execution to get started" />
        )}
      </div>
    </div>
  )
}
