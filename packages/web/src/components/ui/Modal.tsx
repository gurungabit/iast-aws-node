import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  compact?: boolean
  closeOnBackdropClick?: boolean
  closeOnEscape?: boolean
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-5xl xl:max-w-6xl 2xl:max-w-7xl',
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  compact = false,
  closeOnBackdropClick = true,
  closeOnEscape = true,
}: ModalProps) {
  const pad = compact ? 'px-4 py-3' : 'p-6'
  useEffect(() => {
    if (!closeOnEscape) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose, closeOnEscape])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeOnBackdropClick ? onClose : undefined}
      />

      {/* Modal */}
      <div
        className={`
          relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl
          border border-gray-200 dark:border-zinc-700
          w-full mx-4 ${sizeStyles[size]}
          max-h-[90vh] flex flex-col
        `}
      >
        {/* Header */}
        <div className={`flex-none flex items-center justify-between ${pad} border-b border-gray-200 dark:border-zinc-700`}>
          <div className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-zinc-100`}>{title}</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1 h-auto w-auto"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className={`flex-1 min-h-0 ${pad} overflow-y-auto`}>{children}</div>

        {/* Footer */}
        {footer && (
          <div className={`flex-none flex items-center justify-end gap-3 ${pad} border-t border-gray-200 dark:border-zinc-700`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
