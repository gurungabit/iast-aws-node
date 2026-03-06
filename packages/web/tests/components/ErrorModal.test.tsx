import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorModal } from '@src/components/ErrorModal'

vi.mock('lucide-react', () => ({
  X: (props: Record<string, unknown>) => <div data-testid="x-icon" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => <div data-testid="alert-icon" {...props} />,
}))

describe('ErrorModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    message: 'Something went wrong',
  }

  it('renders when isOpen is true', () => {
    render(<ErrorModal {...defaultProps} />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(<ErrorModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('renders default title "Error"', () => {
    render(<ErrorModal {...defaultProps} />)
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('renders custom title', () => {
    render(<ErrorModal {...defaultProps} title="Custom Error" />)
    expect(screen.getByText('Custom Error')).toBeInTheDocument()
  })

  it('renders error message', () => {
    render(<ErrorModal {...defaultProps} message="Connection failed" />)
    expect(screen.getByText('Connection failed')).toBeInTheDocument()
  })

  it('renders alert icon', () => {
    render(<ErrorModal {...defaultProps} />)
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument()
  })

  it('renders OK button', () => {
    render(<ErrorModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()
  })

  it('calls onClose when OK button is clicked', () => {
    const onClose = vi.fn()
    render(<ErrorModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders details when provided', () => {
    render(<ErrorModal {...defaultProps} details="Stack trace: Error at line 42" />)
    expect(screen.getByText('Show details')).toBeInTheDocument()
  })

  it('does not render details when not provided', () => {
    render(<ErrorModal {...defaultProps} />)
    expect(screen.queryByText('Show details')).not.toBeInTheDocument()
  })

  it('shows details content when expanded', () => {
    render(<ErrorModal {...defaultProps} details="Stack trace: Error at line 42" />)
    // Details element should contain the text
    const summary = screen.getByText('Show details')
    fireEvent.click(summary)
    expect(screen.getByText('Stack trace: Error at line 42')).toBeInTheDocument()
  })

  it('calls onClose when close button (X) is clicked', () => {
    const onClose = vi.fn()
    render(<ErrorModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close modal'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<ErrorModal {...defaultProps} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
