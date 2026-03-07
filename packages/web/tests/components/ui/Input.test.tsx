import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from '@src/components/ui/Input'

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders with label', () => {
    render(<Input label="Username" />)
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('renders error message', () => {
    render(<Input error="This field is required" />)
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('renders hint text', () => {
    render(<Input hint="Enter your email" />)
    expect(screen.getByText('Enter your email')).toBeInTheDocument()
  })

  it('does not render hint when error is present', () => {
    render(<Input hint="Hint text" error="Error text" />)
    expect(screen.getByText('Error text')).toBeInTheDocument()
    expect(screen.queryByText('Hint text')).not.toBeInTheDocument()
  })

  it('applies error styles when error is present', () => {
    render(<Input error="Error" />)
    const input = screen.getByRole('textbox')
    expect(input.className).toContain('border-red-500')
  })

  it('is disabled when disabled prop is set', () => {
    render(<Input disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('calls onChange handler', () => {
    const onChange = vi.fn()
    render(<Input onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('generates id from label', () => {
    render(<Input label="First Name" />)
    const input = screen.getByRole('textbox')
    expect(input.id).toBe('input-first-name')
  })

  it('uses provided id over generated one', () => {
    render(<Input label="Name" id="custom-id" />)
    const input = screen.getByRole('textbox')
    expect(input.id).toBe('custom-id')
  })

  it('applies placeholder', () => {
    render(<Input placeholder="Type here..." />)
    expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Input className="my-input" />)
    expect(screen.getByRole('textbox').className).toContain('my-input')
  })

  it('shows red asterisk when required', () => {
    render(<Input label="Email" required />)
    expect(screen.getByText('*')).toBeInTheDocument()
    expect(screen.getByText('*')).toHaveClass('text-red-500')
  })

  it('does not show asterisk when not required', () => {
    render(<Input label="Email" />)
    expect(screen.queryByText('*')).not.toBeInTheDocument()
  })
})
