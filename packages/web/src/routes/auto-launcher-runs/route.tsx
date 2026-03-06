import { createFileRoute } from '@tanstack/react-router'
import { useApiQuery } from '../../hooks/useApi'
import { cn, formatDate, formatTime } from '../../utils'

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
  const { data: runs = [] } = useApiQuery<RunDto[]>(
    ['auto-launcher-runs'],
    '/auto-launcher-runs',
  )

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-white">Auto Launcher Runs</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        {runs.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No runs yet</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {runs.map((run) => (
              <div key={run.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-white">{run.id.slice(0, 12)}</p>
                  <p className="text-[10px] text-gray-500">
                    {formatDate(run.createdAt)} {formatTime(run.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    Step {parseInt(run.currentStepIndex) + 1}/{(run.steps as unknown[]).length}
                  </span>
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-[10px] font-medium',
                      run.status === 'completed' && 'bg-green-900/30 text-green-400',
                      run.status === 'failed' && 'bg-red-900/30 text-red-400',
                      run.status === 'running' && 'bg-blue-900/30 text-blue-400',
                      run.status === 'pending' && 'bg-gray-800 text-gray-400',
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
