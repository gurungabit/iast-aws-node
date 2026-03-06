import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  it('renders a button', () => {
    render(<ThemeToggle theme="dark" onToggle={() => {}} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('renders sun icon when theme is dark', () => {
    const { container } = render(<ThemeToggle theme="dark" onToggle={() => {}} />)
    // Sun icon has text-yellow-400 class
    const sunIcon = container.querySelector('.text-yellow-400')
    expect(sunIcon).toBeInTheDocument()
  })

  it('renders moon icon when theme is light', () => {
    const { container } = render(<ThemeToggle theme="light" onToggle={() => {}} />)
    // Moon icon has text-gray-700 class
    const moonIcon = container.querySelector('.text-gray-700')
    expect(moonIcon).toBeInTheDocument()
  })

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn()
    render(<ThemeToggle theme="dark" onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('has correct aria-label for dark theme', () => {
    render(<ThemeToggle theme="dark" onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to light mode')
  })

  it('has correct aria-label for light theme', () => {
    render(<ThemeToggle theme="light" onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to dark mode')
  })

  it('has correct title for dark theme', () => {
    render(<ThemeToggle theme="dark" onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Switch to light mode')
  })

  it('has correct title for light theme', () => {
    render(<ThemeToggle theme="light" onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Switch to dark mode')
  })
})
