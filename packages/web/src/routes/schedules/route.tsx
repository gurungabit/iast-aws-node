import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Calendar } from 'lucide-react'
import { useApiQuery } from '../../hooks/useApi'
import { cn, formatDate, formatTime } from '../../utils'
import { DatePicker } from '../../components/ui/DatePicker'

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
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const { data: schedules = [] } = useApiQuery<ScheduleDto[]>(
    ['schedules', date],
    `/schedules?date=${date}`,
  )

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Schedules</h1>
          <div className="w-44">
            <DatePicker value={date} onChange={setDate} allowFuture align="right" />
          </div>
        </div>

        {/* Content */}
        {schedules.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-20 text-center">
            <div className="rounded-full bg-gray-100 dark:bg-zinc-800 p-4 mb-4 mx-auto w-fit">
              <Calendar className="h-8 w-8 text-gray-400 dark:text-zinc-500" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">
              No schedules found
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">
              Schedules for this date will appear here
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-gray-100 dark:divide-zinc-800 overflow-hidden">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                    {schedule.astName}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-500">
                    {formatDate(schedule.scheduledTime)} at {formatTime(schedule.scheduledTime)}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium',
                    schedule.status === 'pending' &&
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                    schedule.status === 'completed' &&
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                    schedule.status === 'failed' &&
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
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
