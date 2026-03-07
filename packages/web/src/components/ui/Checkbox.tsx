import { forwardRef, type InputHTMLAttributes } from 'react'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  description?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className = '', id, ...props }, ref) => {
    const checkboxId = id || `checkbox-${label.toLowerCase().replace(/\s+/g, '-')}`

    return (
      <div className={`flex items-start gap-2.5 ${className}`}>
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          className="
            mt-0.5 h-4 w-4 rounded border transition-colors cursor-pointer
            border-gray-300 dark:border-zinc-600
            text-blue-600 dark:text-blue-500
            bg-white dark:bg-zinc-800
            focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          {...props}
        />
        <div className="flex flex-col">
          <label
            htmlFor={checkboxId}
            className="text-sm font-medium text-gray-700 dark:text-zinc-300 cursor-pointer select-none"
          >
            {label}
          </label>
          {description && (
            <span className="text-xs text-gray-500 dark:text-zinc-500">{description}</span>
          )}
        </div>
      </div>
    )
  },
)

Checkbox.displayName = 'Checkbox'
