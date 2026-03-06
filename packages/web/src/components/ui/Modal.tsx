import { type ReactNode, useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="max-w-lg w-full rounded-lg border border-gray-700 bg-gray-900 p-0 text-white backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          &times;
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  )
}
