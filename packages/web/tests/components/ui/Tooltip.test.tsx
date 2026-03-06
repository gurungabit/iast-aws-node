import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Tooltip } from '@src/components/ui/Tooltip'

describe('Tooltip', () => {
  it('renders children', () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>,
    )
    expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument()
  })

  it('does not show tooltip content by default', () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>,
    )
    expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument()
  })

  it('shows tooltip on mouseEnter', () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>,
    )
    const trigger = screen.getByRole('button', { name: 'Hover me' }).parentElement!
    fireEvent.mouseEnter(trigger)
    expect(screen.getByText('Tooltip text')).toBeInTheDocument()
  })

  it('hides tooltip on mouseLeave', () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>,
    )
    const trigger = screen.getByRole('button', { name: 'Hover me' }).parentElement!
    fireEvent.mouseEnter(trigger)
    expect(screen.getByText('Tooltip text')).toBeInTheDocument()

    fireEvent.mouseLeave(trigger)
    expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument()
  })

  it('renders tooltip with fixed positioning when visible', () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>,
    )
    const trigger = screen.getByRole('button', { name: 'Hover me' }).parentElement!
    fireEvent.mouseEnter(trigger)

    const tooltip = screen.getByText('Tooltip text')
    expect(tooltip.className).toContain('fixed')
  })

  it('renders with custom content', () => {
    render(
      <Tooltip content="Custom tooltip message">
        <span>Target</span>
      </Tooltip>,
    )
    const trigger = screen.getByText('Target').parentElement!
    fireEvent.mouseEnter(trigger)
    expect(screen.getByText('Custom tooltip message')).toBeInTheDocument()
  })

  it('supports bottom position', () => {
    render(
      <Tooltip content="Bottom tip" position="bottom">
        <button>Target</button>
      </Tooltip>,
    )
    const trigger = screen.getByText('Target').parentElement!
    fireEvent.mouseEnter(trigger)
    expect(screen.getByText('Bottom tip')).toBeInTheDocument()
  })

  it('supports left position', () => {
    render(
      <Tooltip content="Left tip" position="left">
        <button>Target</button>
      </Tooltip>,
    )
    const trigger = screen.getByText('Target').parentElement!
    fireEvent.mouseEnter(trigger)
    expect(screen.getByText('Left tip')).toBeInTheDocument()
  })

  it('supports right position', () => {
    render(
      <Tooltip content="Right tip" position="right">
        <button>Target</button>
      </Tooltip>,
    )
    const trigger = screen.getByText('Target').parentElement!
    fireEvent.mouseEnter(trigger)
    expect(screen.getByText('Right tip')).toBeInTheDocument()
  })

  it('handles delay prop - tooltip not shown immediately', () => {
    vi.useFakeTimers()
    render(
      <Tooltip content="Delayed" delay={500}>
        <button>Target</button>
      </Tooltip>,
    )
    const trigger = screen.getByText('Target').parentElement!
    fireEvent.mouseEnter(trigger)
    // Should not show immediately with delay
    expect(screen.queryByText('Delayed')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('cancels delay on mouseLeave before timeout', () => {
    vi.useFakeTimers()
    render(
      <Tooltip content="Cancelled" delay={500}>
        <button>Target</button>
      </Tooltip>,
    )
    const trigger = screen.getByText('Target').parentElement!
    fireEvent.mouseEnter(trigger)
    fireEvent.mouseLeave(trigger)
    vi.advanceTimersByTime(500)
    expect(screen.queryByText('Cancelled')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
