import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressBar } from '@src/components/ui/ProgressBar'

describe('ProgressBar', () => {
  it('renders with value', () => {
    const { container } = render(<ProgressBar value={50} />)
    const bar = container.querySelector('[style]')
    expect(bar).toBeInTheDocument()
    expect(bar!.getAttribute('style')).toContain('width: 50%')
  })

  it('renders label', () => {
    render(<ProgressBar value={30} label="Progress" />)
    expect(screen.getByText('Progress')).toBeInTheDocument()
  })

  it('renders message', () => {
    render(<ProgressBar value={60} message="Processing items..." />)
    expect(screen.getByText('Processing items...')).toBeInTheDocument()
  })

  it('renders currentItem', () => {
    render(<ProgressBar value={40} currentItem="item-42" />)
    expect(screen.getByText('item-42')).toBeInTheDocument()
  })

  it('does not render currentItem when not provided', () => {
    const { container } = render(<ProgressBar value={40} />)
    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBe(0)
  })

  it('shows percentage by default', () => {
    render(<ProgressBar value={75} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('hides percentage when showPercentage is false', () => {
    render(<ProgressBar value={75} showPercentage={false} />)
    expect(screen.queryByText('75%')).not.toBeInTheDocument()
  })

  it('clamps value to minimum 0', () => {
    const { container } = render(<ProgressBar value={-10} />)
    const bar = container.querySelector('[style]')
    expect(bar!.getAttribute('style')).toContain('width: 0%')
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('clamps value to maximum 100', () => {
    const { container } = render(<ProgressBar value={150} />)
    const bar = container.querySelector('[style]')
    expect(bar!.getAttribute('style')).toContain('width: 100%')
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('rounds percentage display', () => {
    render(<ProgressBar value={33.7} />)
    expect(screen.getByText('34%')).toBeInTheDocument()
  })

  it('renders with different sizes', () => {
    const { container, rerender } = render(<ProgressBar value={50} size="sm" />)
    expect(container.querySelector('.h-1\\.5')).toBeInTheDocument()

    rerender(<ProgressBar value={50} size="md" />)
    expect(container.querySelector('.h-2\\.5')).toBeInTheDocument()

    rerender(<ProgressBar value={50} size="lg" />)
    expect(container.querySelector('.h-4')).toBeInTheDocument()
  })

  it('renders with different variants', () => {
    const { container, rerender } = render(<ProgressBar value={50} variant="default" />)
    expect(container.querySelector('.bg-blue-500')).toBeInTheDocument()

    rerender(<ProgressBar value={50} variant="success" />)
    expect(container.querySelector('.bg-green-500')).toBeInTheDocument()

    rerender(<ProgressBar value={50} variant="warning" />)
    expect(container.querySelector('.bg-yellow-500')).toBeInTheDocument()

    rerender(<ProgressBar value={50} variant="error" />)
    expect(container.querySelector('.bg-red-500')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<ProgressBar value={50} className="extra" />)
    expect(container.firstElementChild!.className).toContain('extra')
  })

  it('renders at 0% correctly', () => {
    const { container } = render(<ProgressBar value={0} />)
    const bar = container.querySelector('[style]')
    expect(bar!.getAttribute('style')).toContain('width: 0%')
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('renders at 100% correctly', () => {
    const { container } = render(<ProgressBar value={100} />)
    const bar = container.querySelector('[style]')
    expect(bar!.getAttribute('style')).toContain('width: 100%')
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
