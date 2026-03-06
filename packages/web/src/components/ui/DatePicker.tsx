import { forwardRef, useMemo, type InputHTMLAttributes } from 'react'

export interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'min' | 'max'> {
  label?: string
  error?: string
  hint?: string
  maxDaysBack?: number
  allowFuture?: boolean
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, error, hint, maxDaysBack = 10, allowFuture = false, className = '', id, ...props }, ref) => {
    const inputId = id || `datepicker-${label?.toLowerCase().replace(/\s+/g, '-')}`

    const { minDate, maxDate } = useMemo(() => {
      const today = new Date()
      const max = allowFuture ? undefined : today.toISOString().split('T')[0]

      let min: string | undefined
      if (maxDaysBack !== undefined) {
        const minDateObj = new Date(today)
        minDateObj.setDate(minDateObj.getDate() - maxDaysBack)
        min = minDateObj.toISOString().split('T')[0]
      }

      return { minDate: min, maxDate: max }
    }, [maxDaysBack, allowFuture])

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type="date"
          id={inputId}
          min={minDate}
          max={maxDate}
          className={`
            w-full px-3 py-2 text-sm rounded-md border transition-colors
            bg-white dark:bg-zinc-800
            text-gray-900 dark:text-zinc-100
            border-gray-300 dark:border-zinc-600
            focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
            disabled:opacity-50 disabled:cursor-not-allowed
            [&::-webkit-calendar-picker-indicator]:dark:invert
            ${error ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500 dark:text-zinc-500">{hint}</p>}
      </div>
    )
  },
)

DatePicker.displayName = 'DatePicker'
