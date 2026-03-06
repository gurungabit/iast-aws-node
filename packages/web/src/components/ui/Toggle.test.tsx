import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toggle } from './Toggle'

describe('Toggle', () => {
  it('renders with label', () => {
    render(<Toggle label="Dark Mode" />)
    expect(screen.getByText('Dark Mode')).toBeInTheDocument()
  })

  it('renders with description', () => {
    render(<Toggle label="Notifications" description="Enable push notifications" />)
    expect(screen.getByText('Enable push notifications')).toBeInTheDocument()
  })

  it('does not render description when not provided', () => {
    const { container } = render(<Toggle label="Toggle" />)
    const spans = container.querySelectorAll('span.text-xs')
    expect(spans.length).toBe(0)
  })

  it('renders unchecked by default', () => {
    render(<Toggle label="Toggle" />)
    const switchBtn = screen.getByRole('switch')
    expect(switchBtn.getAttribute('aria-checked')).not.toBe('true')
  })

  it('renders checked state', () => {
    render(<Toggle label="Toggle" checked onChange={() => {}} />)
    const switchBtn = screen.getByRole('switch')
    expect(switchBtn.getAttribute('aria-checked')).toBe('true')
  })

  it('renders unchecked state visually', () => {
    render(<Toggle label="Toggle" checked={false} onChange={() => {}} />)
    const switchBtn = screen.getByRole('switch')
    expect(switchBtn.className).toContain('bg-gray-200')
  })

  it('renders checked state visually', () => {
    render(<Toggle label="Toggle" checked onChange={() => {}} />)
    const switchBtn = screen.getByRole('switch')
    expect(switchBtn.className).toContain('bg-blue-600')
  })

  it('calls onChange when the hidden checkbox is triggered', () => {
    const onChange = vi.fn()
    render(<Toggle label="Toggle" checked={false} onChange={onChange} />)
    // The hidden checkbox receives the click
    const checkbox = screen.getByRole('checkbox', { hidden: true })
    fireEvent.click(checkbox)
    expect(onChange).toHaveBeenCalled()
  })

  it('generates id from label', () => {
    render(<Toggle label="Auto Save" />)
    const checkbox = screen.getByRole('checkbox', { hidden: true })
    expect(checkbox.id).toBe('toggle-auto-save')
  })

  it('uses provided id', () => {
    render(<Toggle label="Custom" id="my-toggle" />)
    const checkbox = screen.getByRole('checkbox', { hidden: true })
    expect(checkbox.id).toBe('my-toggle')
  })

  it('applies custom className', () => {
    const { container } = render(<Toggle label="Test" className="my-class" />)
    expect(container.firstElementChild!.className).toContain('my-class')
  })

  it('shows disabled styles when disabled', () => {
    render(<Toggle label="Disabled" disabled />)
    const switchBtn = screen.getByRole('switch')
    expect(switchBtn.className).toContain('opacity-50')
    expect(switchBtn.className).toContain('cursor-not-allowed')
  })

  it('clicking switch button triggers hidden input click', () => {
    const onChange = vi.fn()
    render(<Toggle label="Click Test" checked={false} onChange={onChange} />)
    const switchBtn = screen.getByRole('switch')
    fireEvent.click(switchBtn)
    expect(onChange).toHaveBeenCalled()
  })

  it('clicking switch when disabled does not trigger onChange', () => {
    const onChange = vi.fn()
    render(<Toggle label="No Click" checked={false} onChange={onChange} disabled />)
    const switchBtn = screen.getByRole('switch')
    fireEvent.click(switchBtn)
    expect(onChange).not.toHaveBeenCalled()
  })
})
