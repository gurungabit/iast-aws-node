export type ASTStatus = 'idle' | 'running' | 'paused' | 'success' | 'failed' | 'timeout' | 'cancelled'

export interface StatusBadgeProps {
  status: ASTStatus
  className?: string
}

const statusConfig: Record<ASTStatus, { label: string; className: string }> = {
  idle: {
    label: 'Ready',
    className: 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-400',
  },
  running: {
    label: 'Running',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  paused: {
    label: 'Paused',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  success: {
    label: 'Success',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  timeout: {
    label: 'Timeout',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-400',
  },
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps): React.ReactNode {
  const config = statusConfig[status] ?? statusConfig.idle

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full
        ${config.className}
        ${className}
      `}
    >
      {status === 'running' && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {status === 'paused' && (
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {config.label}
    </span>
  )
}
