import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('renders with primary variant by default', () => {
    render(<Button>Primary</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-blue-600')
  })

  it('renders with secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-gray-100')
  })

  it('renders with danger variant', () => {
    render(<Button variant="danger">Danger</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-red-600')
  })

  it('renders with ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-transparent')
  })

  it('renders with danger-outline variant', () => {
    render(<Button variant="danger-outline">Danger Outline</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('text-red-600')
    expect(btn.className).toContain('bg-transparent')
  })

  it('renders with sm size', () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('px-2.5')
    expect(btn.className).toContain('text-xs')
  })

  it('renders with md size by default', () => {
    render(<Button>Medium</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('px-4')
    expect(btn.className).toContain('text-sm')
  })

  it('renders with lg size', () => {
    render(<Button size="lg">Large</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('px-5')
    expect(btn.className).toContain('text-base')
  })

  it('shows spinner when loading', () => {
    render(<Button isLoading>Loading</Button>)
    const btn = screen.getByRole('button')
    const svg = btn.querySelector('svg')
    expect(svg).toBeInTheDocument()
    // SVGElement in jsdom uses getAttribute('class') rather than className string
    const svgClass = svg!.getAttribute('class') ?? ''
    expect(svgClass).toContain('animate-spin')
  })

  it('is disabled when loading', () => {
    render(<Button isLoading>Loading</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onClick handler', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Click
      </Button>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders leftIcon when not loading', () => {
    render(<Button leftIcon={<span data-testid="left-icon">L</span>}>With Icon</Button>)
    expect(screen.getByTestId('left-icon')).toBeInTheDocument()
  })

  it('renders rightIcon when not loading', () => {
    render(<Button rightIcon={<span data-testid="right-icon">R</span>}>With Icon</Button>)
    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
  })

  it('hides leftIcon when loading and shows spinner instead', () => {
    render(
      <Button isLoading leftIcon={<span data-testid="left-icon">L</span>}>
        Loading
      </Button>,
    )
    expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument()
    const btn = screen.getByRole('button')
    expect(btn.querySelector('svg.animate-spin')).toBeInTheDocument()
  })

  it('hides rightIcon when loading', () => {
    render(
      <Button isLoading rightIcon={<span data-testid="right-icon">R</span>}>
        Loading
      </Button>,
    )
    expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Button className="my-custom-class">Custom</Button>)
    expect(screen.getByRole('button').className).toContain('my-custom-class')
  })
})
