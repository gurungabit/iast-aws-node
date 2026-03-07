import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CredentialsInput } from '@src/ast/shared/CredentialsInput'

describe('CredentialsInput', () => {
  const defaultProps = {
    username: '',
    password: '',
    onUsernameChange: vi.fn(),
    onPasswordChange: vi.fn(),
  }

  it('renders User ID and Password inputs', () => {
    render(<CredentialsInput {...defaultProps} />)

    expect(screen.getByLabelText(/User ID/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument()
  })

  it('displays current username and password values', () => {
    render(
      <CredentialsInput {...defaultProps} username="HERC01" password="secret123" />,
    )

    expect(screen.getByLabelText(/User ID/)).toHaveValue('HERC01')
    expect(screen.getByLabelText(/Password/)).toHaveValue('secret123')
  })

  it('calls onUsernameChange when typing in User ID input', () => {
    const onUsernameChange = vi.fn()
    render(<CredentialsInput {...defaultProps} onUsernameChange={onUsernameChange} />)

    fireEvent.change(screen.getByLabelText(/User ID/), {
      target: { value: 'NEWUSER' },
    })

    expect(onUsernameChange).toHaveBeenCalledWith('NEWUSER')
  })

  it('calls onPasswordChange when typing in Password input', () => {
    const onPasswordChange = vi.fn()
    render(
      <CredentialsInput {...defaultProps} onPasswordChange={onPasswordChange} />,
    )

    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: 'newpass' },
    })

    expect(onPasswordChange).toHaveBeenCalledWith('newpass')
  })

  it('disables both inputs when disabled prop is true', () => {
    render(<CredentialsInput {...defaultProps} disabled />)

    expect(screen.getByLabelText(/User ID/)).toBeDisabled()
    expect(screen.getByLabelText(/Password/)).toBeDisabled()
  })

  it('inputs are not disabled by default', () => {
    render(<CredentialsInput {...defaultProps} />)

    expect(screen.getByLabelText(/User ID/)).not.toBeDisabled()
    expect(screen.getByLabelText(/Password/)).not.toBeDisabled()
  })

  it('renders password input with type="password"', () => {
    render(<CredentialsInput {...defaultProps} />)

    expect(screen.getByLabelText(/Password/)).toHaveAttribute('type', 'password')
  })
})
