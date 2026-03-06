import { Modal } from '../../components/ui/Modal'

interface DataInquiryModalProps {
  isOpen: boolean
  onClose: () => void
}

export function DataInquiryModal({ isOpen, onClose }: DataInquiryModalProps): React.ReactNode {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Data Inquiry" size="xl">
      <div className="p-4 text-sm text-gray-500 dark:text-zinc-400">
        <p>Data inquiry search and results will be available once the backend API is connected.</p>
        <p className="mt-2">This modal provides search across extracted ROUT data with filtering, sorting, and CSV export.</p>
      </div>
    </Modal>
  )
}
