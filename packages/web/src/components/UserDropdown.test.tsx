import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserDropdown } from './UserDropdown'

vi.mock('lucide-react', () => ({
  User: (props: Record<string, unknown>) => <div data-testid="user-icon" {...props} />,
  LogOut: (props: Record<string, unknown>) => <div data-testid="logout-icon" {...props} />,
  ChevronDown: (props: Record<string, unknown>) => <div data-testid="chevron-icon" {...props} />,
}))

describe('UserDropdown', () => {
  const defaultProps = {
    email: 'user@example.com',
    onSignOut: vi.fn(),
  }

  it('renders trigger button with user avatar', () => {
    render(<UserDropdown {...defaultProps} />)
    expect(screen.getByLabelText('User menu')).toBeInTheDocument()
  })

  it('renders user icon in avatar', () => {
    render(<UserDropdown {...defaultProps} />)
    expect(screen.getAllByTestId('user-icon').length).toBeGreaterThan(0)
  })

  it('does not show dropdown by default', () => {
    render(<UserDropdown {...defaultProps} />)
    expect(screen.queryByText('user@example.com')).not.toBeInTheDocument()
  })

  it('opens dropdown on click', () => {
    render(<UserDropdown {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('User menu'))
    expect(screen.getByText('user@example.com')).toBeInTheDocument()
  })

  it('shows email in dropdown', () => {
    render(<UserDropdown {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('User menu'))
    expect(screen.getByText('user@example.com')).toBeInTheDocument()
  })

  it('shows "Signed in" text in dropdown', () => {
    render(<UserDropdown {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('User menu'))
    expect(screen.getByText('Signed in')).toBeInTheDocument()
  })

  it('shows sign out button in dropdown', () => {
    render(<UserDropdown {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('User menu'))
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })

  it('calls onSignOut when sign out is clicked', () => {
    const onSignOut = vi.fn()
    render(<UserDropdown email="test@test.com" onSignOut={onSignOut} />)
    fireEvent.click(screen.getByLabelText('User menu'))
    fireEvent.click(screen.getByText('Sign out'))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('closes dropdown when sign out is clicked', () => {
    render(<UserDropdown {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('User menu'))
    expect(screen.getByText('user@example.com')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Sign out'))
    expect(screen.queryByText('user@example.com')).not.toBeInTheDocument()
  })

  it('toggles dropdown on click', () => {
    render(<UserDropdown {...defaultProps} />)
    const trigger = screen.getByLabelText('User menu')

    fireEvent.click(trigger)
    expect(screen.getByText('user@example.com')).toBeInTheDocument()

    fireEvent.click(trigger)
    expect(screen.queryByText('user@example.com')).not.toBeInTheDocument()
  })

  it('closes dropdown on Escape key', () => {
    render(<UserDropdown {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('User menu'))
    expect(screen.getByText('user@example.com')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('user@example.com')).not.toBeInTheDocument()
  })

  it('closes dropdown on outside click', () => {
    render(
      <div>
        <UserDropdown {...defaultProps} />
        <div data-testid="outside">Outside</div>
      </div>,
    )
    fireEvent.click(screen.getByLabelText('User menu'))
    expect(screen.getByText('user@example.com')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByText('user@example.com')).not.toBeInTheDocument()
  })

  it('sets aria-expanded correctly', () => {
    render(<UserDropdown {...defaultProps} />)
    const trigger = screen.getByLabelText('User menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })
})
