import { forwardRef, type ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-outline' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-blue-600 text-white border-blue-600
    hover:bg-blue-700 hover:border-blue-700
    active:bg-blue-800
    disabled:bg-blue-400 disabled:border-blue-400
  `,
  secondary: `
    bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100
    border-gray-300 dark:border-zinc-600
    hover:bg-gray-200 dark:hover:bg-zinc-700
    active:bg-gray-300 dark:active:bg-zinc-600
  `,
  danger: `
    bg-red-600 text-white border-red-600
    hover:bg-red-700 hover:border-red-700
    active:bg-red-800
  `,
  'danger-outline': `
    bg-transparent text-red-600 dark:text-red-400 border-red-300 dark:border-red-700
    hover:bg-red-50 dark:hover:bg-red-900/20
    active:bg-red-100 dark:active:bg-red-900/30
  `,
  ghost: `
    bg-transparent text-gray-700 dark:text-zinc-300 border-transparent
    hover:bg-gray-100 dark:hover:bg-zinc-800
    active:bg-gray-200 dark:active:bg-zinc-700
  `,
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`
          inline-flex items-center justify-center gap-2
          font-medium rounded-md border transition-colors
          cursor-pointer select-none
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    )
  },
)

Button.displayName = 'Button'
