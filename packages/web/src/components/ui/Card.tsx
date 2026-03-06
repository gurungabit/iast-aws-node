import { type ReactNode } from 'react'
import { cn } from '../../utils'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn('rounded-lg border border-gray-800 bg-gray-900 p-4', className)}>
      {children}
    </div>
  )
}
