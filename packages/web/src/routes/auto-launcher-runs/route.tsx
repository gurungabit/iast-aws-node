import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, ChevronRight } from 'lucide-react'
import { useApiQuery } from '../../hooks/useApi'
import { cn } from '../../utils'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

export const Route = createFileRoute('/auto-launcher-runs')({
  component: AutoLauncherRunsPage,
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunStep {
  astName: string
  configName?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  executionId?: string
  error?: string
  startedAt?: string
  completedAt?: string
  stepLabel?: string
  taskLabel?: string
  order?: number
}

interface RunDto {
  id: string
  launcherId: string
  launcherName?: string
  status: string
  steps: RunStep[]
  currentStepIndex: string
  createdAt: string
  completedAt: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRunStatusColor(status: string): string {
  switch (status) {
    case 'running':
      return 'text-blue-600 dark:text-blue-400'
    case 'completed':
      return 'text-green-600 dark:text-green-400'
    case 'failed':
      return 'text-red-600 dark:text-red-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
}

function getStepStatusColor(status: RunStep['status']): string {
  switch (status) {
    case 'running':
      return 'text-blue-600 dark:text-blue-400'
    case 'completed':
      return 'text-green-600 dark:text-green-400'
    case 'failed':
      return 'text-red-600 dark:text-red-400'
    case 'cancelled':
      return 'text-gray-400 dark:text-zinc-500'
    case 'pending':
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
}

function getActiveStepIndex(run: RunDto): number {
  const fromStatus = run.steps.findIndex((s) => s.status === 'running')
  if (fromStatus >= 0) return fromStatus
  const idx = parseInt(run.currentStepIndex)
  return Math.max(0, idx > 0 ? idx - 1 : 0)
}

// ---------------------------------------------------------------------------
// RunStepCard
// ---------------------------------------------------------------------------

function RunStepCard({
  label,
  sublabel,
  status,
  isActive,
  compact = false,
}: {
  label: string
  sublabel: string
  status: RunStep['status']
  isActive: boolean
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        compact ? 'p-2' : 'p-3',
        'rounded-md border',
        isActive
          ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn(
            compact ? 'text-xs' : 'text-sm',
            'font-medium text-gray-900 dark:text-zinc-100',
          )}
        >
          {label}
        </div>
        <div className={cn('text-xs font-medium', getStepStatusColor(status))}>{status}</div>
      </div>
      <div
        className={cn('mt-1 text-gray-600 dark:text-zinc-400', compact ? 'text-[11px]' : 'text-xs')}
      >
        {sublabel}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CollapsibleStepGroup
// ---------------------------------------------------------------------------

function CollapsibleStepGroup({
  stepLabel,
  configName,
  items,
  groupStatus,
  run,
}: {
  stepLabel: string
  configName?: string
  items: { step: RunStep; globalIdx: number }[]
  groupStatus: RunStep['status']
  run: RunDto
}) {
  const [collapsed, setCollapsed] = useState(false)

  const successCount = items.filter((s) => s.step.status === 'completed').length
  const failedCount = items.filter((s) => s.step.status === 'failed').length
  const totalCount = items.length

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className={cn(
          'w-full text-left p-3 rounded-md border cursor-pointer transition-colors',
          groupStatus === 'running'
            ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'
            : 'border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50',
          'hover:bg-gray-100 dark:hover:bg-zinc-800/50',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ChevronRight
              className={cn(
                'w-3.5 h-3.5 text-gray-500 dark:text-zinc-400 transition-transform',
                !collapsed && 'rotate-90',
              )}
            />
            <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">
              {stepLabel}
              {configName ? ` — ${configName}` : ''}
            </div>
            <div className="text-xs text-gray-500 dark:text-zinc-500">
              ({String(totalCount)} tasks)
            </div>
          </div>
          <div className="flex items-center gap-2">
            {groupStatus !== 'pending' && (
              <div className="text-xs text-gray-500 dark:text-zinc-500">
                {successCount}/{totalCount}
                {failedCount > 0 ? ` (${String(failedCount)} failed)` : ''}
              </div>
            )}
            <div className={cn('text-xs font-medium', getStepStatusColor(groupStatus))}>
              {groupStatus}
            </div>
          </div>
        </div>
      </button>
      {!collapsed && (
        <div className="pl-4 space-y-1">
          {items.map(({ step, globalIdx }) => {
            const activeIdx = getActiveStepIndex(run)
            const isActive =
              run.status === 'running' && globalIdx === activeIdx && step.status === 'running'
            return (
              <RunStepCard
                key={`${String(globalIdx)}-${step.astName}`}
                label={step.taskLabel ?? `Task ${String(globalIdx + 1)}`}
                sublabel={step.astName}
                status={step.status}
                isActive={isActive}
                compact
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function AutoLauncherRunsPage() {
  const {
    data: runs = [],
    isLoading,
    refetch,
  } = useApiQuery<RunDto[]>(['auto-launcher-runs'], '/auto-launcher-runs')

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  // Derive selected run from list (auto-select first if nothing selected)
  const effectiveRunId = selectedRunId ?? (runs.length > 0 ? runs[0].id : null)
  const selectedRun = useMemo(
    () => runs.find((r) => r.id === effectiveRunId) ?? null,
    [runs, effectiveRunId],
  )

  // Poll while there are running runs
  const shouldPoll = runs.some((r) => r.status === 'running') || selectedRun?.status === 'running'
  useEffect(() => {
    if (!shouldPoll) return
    const id = window.setInterval(() => {
      void refetch()
    }, 2000)
    return () => window.clearInterval(id)
  }, [shouldPoll, refetch])

  return (
    <div className="flex-1 overflow-auto bg-gray-50 dark:bg-zinc-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
              AutoLauncher Runs
            </h1>
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              Track which step is running and view step-by-step status
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading}
            leftIcon={<RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />}
          >
            Refresh
          </Button>
        </div>

        {/* 2-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Runs list (1/3) */}
          <Card noPadding className="lg:col-span-1">
            <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
              <div className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Runs</div>
              <div className="text-xs text-gray-600 dark:text-zinc-400">Newest first</div>
            </div>
            <div className="p-2 max-h-[70vh] overflow-auto">
              {isLoading ? (
                <div className="p-3 text-sm text-gray-600 dark:text-zinc-400">Loading...</div>
              ) : runs.length === 0 ? (
                <div className="p-3 text-sm text-gray-600 dark:text-zinc-400">No runs yet.</div>
              ) : (
                runs.map((r) => {
                  const activeIdx = getActiveStepIndex(r)
                  const active = r.steps[activeIdx]
                  const isSelected = r.id === selectedRunId
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelectedRunId(r.id)
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md border transition-colors cursor-pointer mb-2',
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                          : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                          {r.launcherName ?? r.launcherId}
                        </div>
                        <div className={cn('text-xs font-medium', getRunStatusColor(r.status))}>
                          {r.status}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-gray-600 dark:text-zinc-400 truncate">
                        {active ? `Step ${String(activeIdx + 1)}: ${active.astName}` : 'No steps'}
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">
                        {new Date(r.createdAt).toLocaleString()}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </Card>

          {/* Run details (2/3) */}
          <Card noPadding className="lg:col-span-2">
            <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                    Run Details
                  </div>
                  {selectedRun && (
                    <div className="text-xs text-gray-600 dark:text-zinc-400">
                      {new Date(selectedRun.createdAt).toLocaleString()}
                      <span className="mx-1">&middot;</span>
                      runId={selectedRun.id.slice(0, 12)}
                    </div>
                  )}
                </div>
                {selectedRun && (
                  <div className={cn('text-sm font-medium', getRunStatusColor(selectedRun.status))}>
                    {selectedRun.status}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 space-y-4">
              {!selectedRun ? (
                <div className="text-sm text-gray-600 dark:text-zinc-400">Select a run.</div>
              ) : (
                <>
                  {/* Steps */}
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-2">
                      Steps
                    </div>
                    <div className="space-y-2">
                      {(() => {
                        const steps = selectedRun.steps
                        const hasGrouping = steps.some((s) => s.stepLabel)

                        if (!hasGrouping) {
                          // Flat rendering
                          return steps.map((s, idx) => {
                            const activeIdx = getActiveStepIndex(selectedRun)
                            const isActive =
                              selectedRun.status === 'running' &&
                              idx === activeIdx &&
                              s.status === 'running'
                            return (
                              <RunStepCard
                                key={`${String(idx)}-${s.astName}`}
                                label={`Step ${String(idx + 1)} — ${s.configName ?? s.astName}`}
                                sublabel={
                                  s.astName
                                }
                                status={s.status}
                                isActive={isActive}
                              />
                            )
                          })
                        }

                        // Group by stepLabel
                        type StepGroup = {
                          stepLabel: string
                          configName?: string
                          items: { step: RunStep; globalIdx: number }[]
                        }
                        const groups: StepGroup[] = []
                        let currentGroup: StepGroup | null = null

                        for (let i = 0; i < steps.length; i++) {
                          const step = steps[i]
                          const label = step.stepLabel ?? `Step ${String(i + 1)}`
                          if (!currentGroup || currentGroup.stepLabel !== label) {
                            currentGroup = {
                              stepLabel: label,
                              configName: step.configName,
                              items: [],
                            }
                            groups.push(currentGroup)
                          }
                          currentGroup.items.push({ step, globalIdx: i })
                        }

                        return groups.map((group) => {
                          const isSingleTask =
                            group.items.length === 1 && !group.items[0].step.taskLabel
                          const groupStatus: RunStep['status'] = group.items.every(
                            (s) => s.step.status === 'completed',
                          )
                            ? 'completed'
                            : group.items.some((s) => s.step.status === 'failed')
                              ? 'failed'
                              : group.items.some((s) => s.step.status === 'running')
                                ? 'running'
                                : 'pending'

                          if (isSingleTask) {
                            const { step, globalIdx } = group.items[0]
                            const activeIdx = getActiveStepIndex(selectedRun)
                            const isActive =
                              selectedRun.status === 'running' &&
                              globalIdx === activeIdx &&
                              step.status === 'running'
                            return (
                              <RunStepCard
                                key={group.stepLabel}
                                label={`${group.stepLabel} — ${step.configName ?? step.astName}`}
                                sublabel={
                                  step.executionId
                                    ? `executionId=${step.executionId}`
                                    : 'executionId=—'
                                }
                                status={step.status}
                                isActive={isActive}
                              />
                            )
                          }

                          return (
                            <CollapsibleStepGroup
                              key={group.stepLabel}
                              stepLabel={group.stepLabel}
                              configName={group.configName}
                              items={group.items}
                              groupStatus={groupStatus}
                              run={selectedRun}
                            />
                          )
                        })
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
