import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Rocket } from 'lucide-react'
import { useApiQuery } from '../../hooks/useApi'
import { cn, formatDate, formatTime } from '../../utils'
import { DatePicker } from '../../components/ui/DatePicker'

export const Route = createFileRoute('/auto-launcher-runs')({
  component: AutoLauncherRunsPage,
})

interface RunDto {
  id: string
  launcherId: string
  status: string
  steps: unknown[]
  currentStepIndex: string
  createdAt: string
  completedAt: string | null
}

function AutoLauncherRunsPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const { data: runs = [] } = useApiQuery<RunDto[]>(
    ['auto-launcher-runs', date],
    `/auto-launcher-runs?date=${date}`,
  )

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
            AutoLauncher Runs
          </h1>
          <div className="w-44">
            <DatePicker value={date} onChange={setDate} align="right" />
          </div>
        </div>

        {/* Content */}
        {runs.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-20 text-center">
            <div className="rounded-full bg-gray-100 dark:bg-zinc-800 p-4 mb-4 mx-auto w-fit">
              <Rocket className="h-8 w-8 text-gray-400 dark:text-zinc-500" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">No runs found</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">
              AutoLauncher runs for this date will appear here
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-gray-100 dark:divide-zinc-800 overflow-hidden">
            {runs.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
              >
                <div>
                  <p className="text-sm font-medium font-mono text-gray-900 dark:text-zinc-100">
                    {run.id.slice(0, 12)}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-500">
                    {formatDate(run.createdAt)} at {formatTime(run.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-zinc-400">
                    Step {parseInt(run.currentStepIndex) + 1}/{(run.steps as unknown[]).length}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-medium',
                      run.status === 'completed' &&
                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                      run.status === 'failed' &&
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                      run.status === 'running' &&
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                      run.status === 'pending' &&
                        'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
                    )}
                  >
                    {run.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
