import { createFileRoute } from '@tanstack/react-router'
import { useApiQuery } from '../../hooks/useApi'
import { cn, formatDate, formatTime } from '../../utils'

export const Route = createFileRoute('/schedules')({
  component: SchedulesPage,
})

interface ScheduleDto {
  id: string
  astName: string
  scheduledTime: string
  status: string
  createdAt: string
}

function SchedulesPage() {
  const { data: schedules = [] } = useApiQuery<ScheduleDto[]>(
    ['schedules'],
    '/schedules',
  )

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-white">Schedules</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        {schedules.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No schedules</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-white">{schedule.astName}</p>
                  <p className="text-[10px] text-gray-500">
                    Scheduled: {formatDate(schedule.scheduledTime)} {formatTime(schedule.scheduledTime)}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-[10px] font-medium',
                    schedule.status === 'pending' && 'bg-yellow-900/30 text-yellow-400',
                    schedule.status === 'completed' && 'bg-green-900/30 text-green-400',
                    schedule.status === 'failed' && 'bg-red-900/30 text-red-400',
                  )}
                >
                  {schedule.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
