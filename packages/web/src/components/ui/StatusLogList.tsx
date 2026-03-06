export interface StatusLogListProps {
  messages: string[]
  maxHeight?: string
  className?: string
}

export function StatusLogList({ messages, maxHeight = '120px', className = '' }: StatusLogListProps): React.ReactNode {
  if (messages.length === 0) return null

  return (
    <div
      className={`overflow-y-auto text-xs font-mono bg-gray-50 dark:bg-zinc-900 rounded-md border border-gray-200 dark:border-zinc-700 p-2 ${className}`}
      style={{ maxHeight }}
    >
      {messages.map((message, index) => (
        <div
          key={index}
          className="py-0.5 text-gray-700 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800 last:border-0"
        >
          <span className="text-gray-400 dark:text-zinc-600 mr-2">{index + 1}.</span>
          {message}
        </div>
      ))}
    </div>
  )
}
