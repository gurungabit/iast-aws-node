import { forwardRef, type InputHTMLAttributes } from 'react'

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  description?: string
}

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, description, className = '', id, checked, ...props }, ref) => {
    const toggleId = id || `toggle-${label.toLowerCase().replace(/\s+/g, '-')}`

    return (
      <div className={`flex items-center justify-between gap-3 max-w-sm ${className}`}>
        <div className="flex flex-col">
          <label
            htmlFor={toggleId}
            className="text-sm font-medium text-gray-700 dark:text-zinc-300 cursor-pointer select-none"
          >
            {label}
          </label>
          {description && (
            <span className="text-xs text-gray-500 dark:text-zinc-500">{description}</span>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => {
            const input = document.getElementById(toggleId) as HTMLInputElement
            if (input && !props.disabled) input.click()
          }}
          className={`
            shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-900
            ${props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-zinc-700'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200
              ${checked ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
        <input
          ref={ref}
          type="checkbox"
          id={toggleId}
          checked={checked}
          className="sr-only"
          {...props}
        />
      </div>
    )
  },
)

Toggle.displayName = 'Toggle'
