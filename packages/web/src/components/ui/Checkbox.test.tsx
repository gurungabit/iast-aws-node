import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  it('renders with label', () => {
    render(<Checkbox label="Remember me" />)
    expect(screen.getByText('Remember me')).toBeInTheDocument()
  })

  it('renders a checkbox input', () => {
    render(<Checkbox label="Agree" />)
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('renders with description', () => {
    render(<Checkbox label="Terms" description="Accept terms and conditions" />)
    expect(screen.getByText('Accept terms and conditions')).toBeInTheDocument()
  })

  it('does not render description when not provided', () => {
    const { container } = render(<Checkbox label="Check" />)
    const descriptions = container.querySelectorAll('span.text-xs')
    expect(descriptions.length).toBe(0)
  })

  it('renders checked state', () => {
    render(<Checkbox label="Check" checked onChange={() => {}} />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('renders unchecked state', () => {
    render(<Checkbox label="Check" checked={false} onChange={() => {}} />)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('calls onChange when clicked', () => {
    const onChange = vi.fn()
    render(<Checkbox label="Check" onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('generates id from label', () => {
    render(<Checkbox label="My Checkbox" />)
    expect(screen.getByRole('checkbox').id).toBe('checkbox-my-checkbox')
  })

  it('uses provided id', () => {
    render(<Checkbox label="Label" id="custom-id" />)
    expect(screen.getByRole('checkbox').id).toBe('custom-id')
  })

  it('is disabled when disabled prop is set', () => {
    render(<Checkbox label="Disabled" disabled />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('applies custom className', () => {
    const { container } = render(<Checkbox label="Test" className="extra-class" />)
    expect(container.firstElementChild!.className).toContain('extra-class')
  })

  it('label is associated with checkbox via htmlFor', () => {
    render(<Checkbox label="Associated" />)
    const checkbox = screen.getByRole('checkbox')
    const label = screen.getByText('Associated')
    expect(label.tagName).toBe('LABEL')
    expect(label.getAttribute('for')).toBe(checkbox.id)
  })
})
