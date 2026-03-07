import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { cn } from '../../utils'

export interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  label?: string
  error?: string
  hint?: string
  maxDaysBack?: number
  allowFuture?: boolean
  disabled?: boolean
  className?: string
  align?: 'left' | 'right'
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDisplay(s: string): string {
  const d = parseDate(s)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

type PickerView = 'days' | 'months' | 'years'

export function DatePicker({
  value,
  onChange,
  label,
  error,
  hint,
  maxDaysBack,
  allowFuture = false,
  disabled = false,
  className = '',
  align = 'left',
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<PickerView>('days')
  const [yearRangeStart, setYearRangeStart] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const selectedDate = value || toDateStr(today)

  const [viewYear, setViewYear] = useState(() => parseDate(selectedDate).getFullYear())
  const [viewMonth, setViewMonth] = useState(() => parseDate(selectedDate).getMonth())

  const { minDate, maxDate } = useMemo(() => {
    const min =
      maxDaysBack != null
        ? (() => {
            const d = new Date(today)
            d.setDate(d.getDate() - maxDaysBack)
            return d
          })()
        : null
    const max = allowFuture ? null : new Date(today)
    return { minDate: min, maxDate: max }
  }, [today, maxDaysBack, allowFuture])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const isDateDisabled = useCallback(
    (date: Date): boolean => {
      if (minDate && date < minDate) return true
      if (maxDate && date > maxDate) return true
      return false
    },
    [minDate, maxDate],
  )

  const canGoPrev = useMemo(() => {
    if (!minDate) return true
    const firstOfView = new Date(viewYear, viewMonth, 1)
    return firstOfView > minDate
  }, [viewYear, viewMonth, minDate])

  const canGoNext = useMemo(() => {
    if (allowFuture) return true
    const lastOfView = new Date(viewYear, viewMonth + 1, 0)
    return maxDate
      ? lastOfView < maxDate ||
          (viewYear === maxDate.getFullYear() && viewMonth < maxDate.getMonth())
      : true
  }, [viewYear, viewMonth, maxDate, allowFuture])

  const goPrev = () => {
    if (!canGoPrev) return
    if (viewMonth === 0) {
      setViewYear(viewYear - 1)
      setViewMonth(11)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const goNext = () => {
    if (!canGoNext) return
    if (viewMonth === 11) {
      setViewYear(viewYear + 1)
      setViewMonth(0)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const selectDate = (day: number) => {
    const date = new Date(viewYear, viewMonth, day)
    if (isDateDisabled(date)) return
    onChange?.(toDateStr(date))
    setOpen(false)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth)
  const todayStr = toDateStr(today)

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const openMonthView = () => setView('months')
  const openYearView = () => {
    setYearRangeStart(viewYear - 4)
    setView('years')
  }

  const selectMonth = (month: number) => {
    setViewMonth(month)
    setView('days')
  }

  const selectYear = (year: number) => {
    setViewYear(year)
    setView('months')
  }

  const yearRange = Array.from({ length: 12 }, (_, i) => yearRangeStart + i)

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open) {
            const d = parseDate(selectedDate)
            setViewYear(d.getFullYear())
            setViewMonth(d.getMonth())
            setView('days')
          }
          setOpen(!open)
        }}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors cursor-pointer',
          'bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100',
          error
            ? 'border-red-500 focus:ring-red-500/50'
            : 'border-gray-300 dark:border-zinc-600 hover:border-gray-400 dark:hover:border-zinc-500',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        aria-label={label || 'Select date'}
      >
        <Calendar className="h-4 w-4 text-gray-400 dark:text-zinc-500 shrink-0" />
        <span className="flex-1 text-left">{formatDisplay(selectedDate)}</span>
      </button>

      {error && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-gray-500 dark:text-zinc-500">{hint}</p>}

      {open && (
        <div
          className={cn(
            'absolute top-full z-50 mt-1.5 w-72 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-3',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {view === 'days' && (
            <>
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={!canGoPrev}
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-zinc-400" />
                </button>
                <button
                  type="button"
                  onClick={openMonthView}
                  className="text-sm font-semibold text-gray-900 dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  aria-label="Select month and year"
                >
                  {MONTHS[viewMonth]} {viewYear}
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canGoNext}
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4 text-gray-600 dark:text-zinc-400" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-[10px] font-medium text-gray-400 dark:text-zinc-500 py-1"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                  if (day === null) {
                    return <div key={`empty-${i}`} />
                  }

                  const dateObj = new Date(viewYear, viewMonth, day)
                  const dateStr = toDateStr(dateObj)
                  const isSelected = dateStr === selectedDate
                  const isToday = dateStr === todayStr
                  const isDisabled = isDateDisabled(dateObj)

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => selectDate(day)}
                      className={cn(
                        'h-8 w-full rounded-lg text-xs font-medium transition-colors cursor-pointer',
                        isSelected
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : isToday
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                            : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800',
                        isDisabled &&
                          'opacity-30 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent',
                      )}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>

              {/* Today shortcut */}
              {!isDateDisabled(today) && (
                <button
                  type="button"
                  onClick={() => {
                    setViewYear(today.getFullYear())
                    setViewMonth(today.getMonth())
                    selectDate(today.getDate())
                  }}
                  className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                >
                  Today
                </button>
              )}
            </>
          )}

          {view === 'months' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setViewYear(viewYear - 1)}
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                  aria-label="Previous year"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-zinc-400" />
                </button>
                <button
                  type="button"
                  onClick={openYearView}
                  className="text-sm font-semibold text-gray-900 dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  aria-label="Select year"
                >
                  {viewYear}
                </button>
                <button
                  type="button"
                  onClick={() => setViewYear(viewYear + 1)}
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                  aria-label="Next year"
                >
                  <ChevronRight className="h-4 w-4 text-gray-600 dark:text-zinc-400" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {SHORT_MONTHS.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => selectMonth(i)}
                    className={cn(
                      'py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                      i === viewMonth
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : i === today.getMonth() && viewYear === today.getFullYear()
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                          : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800',
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}

          {view === 'years' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setYearRangeStart(yearRangeStart - 12)}
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                  aria-label="Previous years"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-zinc-400" />
                </button>
                <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                  {yearRangeStart} – {yearRangeStart + 11}
                </span>
                <button
                  type="button"
                  onClick={() => setYearRangeStart(yearRangeStart + 12)}
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                  aria-label="Next years"
                >
                  <ChevronRight className="h-4 w-4 text-gray-600 dark:text-zinc-400" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {yearRange.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => selectYear(year)}
                    className={cn(
                      'py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                      year === viewYear
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : year === today.getFullYear()
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                          : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800',
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
