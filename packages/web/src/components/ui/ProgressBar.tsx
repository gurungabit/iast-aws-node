export interface ProgressBarProps {
  value: number
  label?: string
  currentItem?: string
  message?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'success' | 'warning' | 'error'
  showPercentage?: boolean
  className?: string
}

const sizeStyles = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
}

const variantStyles = {
  default: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
}

export function ProgressBar({
  value,
  label,
  currentItem,
  message,
  size = 'md',
  variant = 'default',
  showPercentage = true,
  className = '',
}: ProgressBarProps): React.ReactNode {
  const clampedValue = Math.max(0, Math.min(100, value))

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">{label}</span>}
          {showPercentage && (
            <span className="text-xs text-gray-500 dark:text-zinc-500">{Math.round(clampedValue)}%</span>
          )}
        </div>
      )}

      <div className={`w-full rounded-full overflow-hidden bg-gray-200 dark:bg-zinc-700 ${sizeStyles[size]}`}>
        <div
          className={`h-full transition-[width] duration-300 ease-out rounded-full ${variantStyles[variant]}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>

      <div className="mt-1.5 min-h-[1.25rem] text-xs text-blue-600 dark:text-blue-400 font-medium">
        {message ?? ''}
      </div>

      <div className="mt-1 min-h-[1.25rem] flex items-center gap-1.5">
        {currentItem ? (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs text-gray-600 dark:text-zinc-400 truncate">{currentItem}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}
