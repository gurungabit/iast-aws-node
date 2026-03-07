import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { AlertCircle } from 'lucide-react'

export interface ErrorModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message: string
  details?: string
}

export function ErrorModal({
  isOpen,
  onClose,
  title = 'Error',
  message,
  details,
}: ErrorModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          {title}
        </div>
      }
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-zinc-300">{message}</p>
        {details && (
          <details className="text-xs text-gray-500 dark:text-zinc-500">
            <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-zinc-300">
              Show details
            </summary>
            <pre className="mt-2 whitespace-pre-wrap bg-gray-100 dark:bg-zinc-800 p-2 rounded text-xs">
              {details}
            </pre>
          </details>
        )}
      </div>

      <div className="flex justify-end mt-4">
        <Button type="button" variant="primary" onClick={onClose}>
          OK
        </Button>
      </div>
    </Modal>
  )
}
