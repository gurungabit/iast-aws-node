import { useState, useEffect } from 'react'
import { DatePicker } from './DatePicker'

interface DateTimePickerProps {
  value: string | null
  onChange: (isoString: string, timezone: string) => void
  minDate?: Date
  className?: string
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'UTC', label: 'UTC' },
]

function getDefaultTimezone(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return TIMEZONES.find((t) => t.value === tz)?.value ?? 'America/Chicago'
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatTimeForInput(date: Date): string {
  return date.toTimeString().slice(0, 5)
}

export function DateTimePicker({
  value,
  onChange,
  minDate = new Date(),
  className = '',
}: DateTimePickerProps): React.ReactNode {
  const [timezone, setTimezone] = useState(getDefaultTimezone)
  const [dateStr, setDateStr] = useState('')
  const [timeStr, setTimeStr] = useState('09:00')

  useEffect(() => {
    if (value) {
      const date = new Date(value)
      setDateStr(formatDateForInput(date))
      setTimeStr(formatTimeForInput(date))
    } else {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)
      setDateStr(formatDateForInput(tomorrow))
      setTimeStr('09:00')
    }
  }, [value])

  useEffect(() => {
    if (dateStr && timeStr) {
      const localDateTime = `${dateStr}T${timeStr}:00`
      const date = new Date(localDateTime)
      onChange(date.toISOString(), timezone)
    }
  }, [dateStr, timeStr, timezone, onChange])

  const minDaysBack = Math.ceil((Date.now() - minDate.getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="grid grid-cols-2 gap-3">
        <DatePicker
          label="Date"
          value={dateStr}
          onChange={setDateStr}
          maxDaysBack={minDaysBack}
          allowFuture
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Time</label>
          <input
            type="time"
            value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 cursor-pointer"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Timezone</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 cursor-pointer"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
