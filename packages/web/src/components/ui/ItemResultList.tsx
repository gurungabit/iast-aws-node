import { Circle, Loader2, Check, X, Ban } from 'lucide-react'

export type ASTItemStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

export interface ASTItemResult {
  itemId: string
  status: ASTItemStatus
  durationMs?: number
  error?: string
}

export interface ItemResultListProps {
  items: ASTItemResult[]
  maxHeight?: string
  className?: string
}

const statusStyles = {
  pending: 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400',
  running: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  skipped: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
}

function StatusIcon({ status, className = 'w-3.5 h-3.5' }: { status: ASTItemStatus; className?: string }) {
  switch (status) {
    case 'pending':
      return <Circle className={className} />
    case 'running':
      return <Loader2 className={`${className} animate-spin`} />
    case 'success':
      return <Check className={className} />
    case 'failed':
      return <X className={className} />
    case 'skipped':
      return <Ban className={className} />
  }
}

export function ItemResultList({ items, maxHeight = '200px', className = '' }: ItemResultListProps): React.ReactNode {
  if (items.length === 0) return null

  return (
    <div className={`space-y-1 overflow-y-auto ${className}`} style={{ maxHeight }}>
      {items.map((item, index) => (
        <div key={`${item.itemId}-${index}`} className={`px-2 py-1.5 rounded text-xs ${statusStyles[item.status]}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <StatusIcon status={item.status} />
              <span className="font-mono truncate">{item.itemId}</span>
            </div>
            {item.durationMs !== undefined && (
              <span className="text-[10px] opacity-75 flex-shrink-0">{item.durationMs}ms</span>
            )}
          </div>
          {item.error && (
            <p className="mt-1 text-[11px] text-red-600 dark:text-red-400 break-words pl-5">{item.error}</p>
          )}
        </div>
      ))}
    </div>
  )
}
