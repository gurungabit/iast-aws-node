import { useState, useEffect } from 'react'

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

  const minDateStr = formatDateForInput(minDate)

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Date</label>
          <input
            type="date"
            value={dateStr}
            min={minDateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Time</label>
          <input
            type="time"
            value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)}
            className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Timezone</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
