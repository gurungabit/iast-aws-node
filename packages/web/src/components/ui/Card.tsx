import { type HTMLAttributes, type ReactNode } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  footer?: ReactNode
  noPadding?: boolean
}

export function Card({
  title,
  description,
  footer,
  noPadding = false,
  className = '',
  children,
  ...props
}: CardProps): React.ReactNode {
  return (
    <div
      className={`
        rounded-lg border
        bg-white dark:bg-zinc-900
        border-gray-200 dark:border-zinc-800
        ${className}
      `}
      {...props}
    >
      {(title || description) && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
          {title && (
            <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{title}</h3>
          )}
          {description && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-500">{description}</p>
          )}
        </div>
      )}
      <div className={noPadding ? '' : 'p-4'}>{children}</div>
      {footer && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 rounded-b-lg">
          {footer}
        </div>
      )}
    </div>
  )
}
