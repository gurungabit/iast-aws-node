import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '@src/components/ui/Modal'

vi.mock('lucide-react', () => ({
  X: (props: Record<string, unknown>) => <div data-testid="x-icon" {...props} />,
}))

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    children: <p>Modal content</p>,
  }

  it('renders when isOpen is true', () => {
    render(<Modal {...defaultProps} />)
    expect(screen.getByText('Modal content')).toBeInTheDocument()
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(<Modal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument()
  })

  it('renders title', () => {
    render(<Modal {...defaultProps} title="My Title" />)
    expect(screen.getByText('My Title')).toBeInTheDocument()
  })

  it('renders footer', () => {
    render(<Modal {...defaultProps} footer={<button>Save</button>} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('does not render footer when no footer prop', () => {
    const { container } = render(<Modal {...defaultProps} />)
    // Footer has a specific structure with border-t in a flex justify-end div
    const footerElements = container.querySelectorAll('.justify-end.gap-3')
    expect(footerElements.length).toBe(0)
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<Modal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close modal'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<Modal {...defaultProps} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose on Escape when closeOnEscape is false', () => {
    const onClose = vi.fn()
    render(<Modal {...defaultProps} onClose={onClose} closeOnEscape={false} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<Modal {...defaultProps} onClose={onClose} />)
    // Backdrop is the element with bg-black/50
    const backdrop = container.querySelector('.bg-black\\/50')
    expect(backdrop).toBeInTheDocument()
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose on backdrop click when closeOnBackdropClick is false', () => {
    const onClose = vi.fn()
    const { container } = render(<Modal {...defaultProps} onClose={onClose} closeOnBackdropClick={false} />)
    const backdrop = container.querySelector('.bg-black\\/50')
    fireEvent.click(backdrop!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders with different sizes', () => {
    const { container, rerender } = render(<Modal {...defaultProps} size="sm" />)
    expect(container.querySelector('.max-w-md')).toBeInTheDocument()

    rerender(<Modal {...defaultProps} size="lg" />)
    expect(container.querySelector('.max-w-2xl')).toBeInTheDocument()

    rerender(<Modal {...defaultProps} size="xl" />)
    expect(container.querySelector('.max-w-4xl')).toBeInTheDocument()
  })

  it('sets body overflow to hidden when open', () => {
    render(<Modal {...defaultProps} />)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('resets body overflow when closed', () => {
    const { unmount } = render(<Modal {...defaultProps} />)
    unmount()
    expect(document.body.style.overflow).toBe('unset')
  })
})
