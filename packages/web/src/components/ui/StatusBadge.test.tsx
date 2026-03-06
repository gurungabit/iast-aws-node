import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge, type ASTStatus } from './StatusBadge'

describe('StatusBadge', () => {
  const statuses: Array<{ status: ASTStatus; label: string }> = [
    { status: 'idle', label: 'Ready' },
    { status: 'running', label: 'Running' },
    { status: 'paused', label: 'Paused' },
    { status: 'success', label: 'Success' },
    { status: 'failed', label: 'Failed' },
    { status: 'timeout', label: 'Timeout' },
    { status: 'cancelled', label: 'Cancelled' },
  ]

  statuses.forEach(({ status, label }) => {
    it(`renders "${label}" for status "${status}"`, () => {
      render(<StatusBadge status={status} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('shows ping animation for running status', () => {
    const { container } = render(<StatusBadge status="running" />)
    const pingElement = container.querySelector('.animate-ping')
    expect(pingElement).toBeInTheDocument()
  })

  it('does not show ping animation for idle status', () => {
    const { container } = render(<StatusBadge status="idle" />)
    const pingElement = container.querySelector('.animate-ping')
    expect(pingElement).not.toBeInTheDocument()
  })

  it('does not show ping animation for success status', () => {
    const { container } = render(<StatusBadge status="success" />)
    const pingElement = container.querySelector('.animate-ping')
    expect(pingElement).not.toBeInTheDocument()
  })

  it('does not show ping animation for failed status', () => {
    const { container } = render(<StatusBadge status="failed" />)
    const pingElement = container.querySelector('.animate-ping')
    expect(pingElement).not.toBeInTheDocument()
  })

  it('shows paused indicator dot for paused status', () => {
    const { container } = render(<StatusBadge status="paused" />)
    // Paused shows a static dot (no ping)
    const dots = container.querySelectorAll('.rounded-full.bg-current')
    expect(dots.length).toBeGreaterThan(0)
    expect(container.querySelector('.animate-ping')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<StatusBadge status="idle" className="extra-class" />)
    const badge = screen.getByText('Ready')
    expect(badge.className).toContain('extra-class')
  })

  it('applies correct color classes for each status', () => {
    const { rerender } = render(<StatusBadge status="success" />)
    expect(screen.getByText('Success').className).toContain('bg-green-100')

    rerender(<StatusBadge status="failed" />)
    expect(screen.getByText('Failed').className).toContain('bg-red-100')

    rerender(<StatusBadge status="running" />)
    expect(screen.getByText('Running').className).toContain('bg-blue-100')
  })
})
