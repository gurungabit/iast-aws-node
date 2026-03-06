import { Modal } from './ui/Modal'
import { Button } from './ui/Button'

interface ErrorModalProps {
  open: boolean
  onClose: () => void
  title?: string
  message: string
}

export function ErrorModal({ open, onClose, title = 'Error', message }: ErrorModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-gray-300">{message}</p>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  )
}
