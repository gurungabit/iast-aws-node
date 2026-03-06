import { type InputHTMLAttributes } from 'react'
import { cn } from '../../utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className, id, ...props }: InputProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-400">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'w-full rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
          className,
        )}
        {...props}
      />
    </div>
  )
}
