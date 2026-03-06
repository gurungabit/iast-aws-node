import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RoutExtractorForm } from './RoutExtractorForm'

Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'test-uuid' },
})

describe('RoutExtractorForm', () => {
  it('renders credentials and run button', () => {
    render(<RoutExtractorForm sessionId="s1" onRun={vi.fn()} />)
    expect(screen.getByPlaceholderText('HERC01')).toBeDefined()
    expect(screen.getByText('Run Route Extractor')).toBeDefined()
  })

  it('run button disabled without credentials', () => {
    render(<RoutExtractorForm sessionId="s1" onRun={vi.fn()} />)
    expect(screen.getByText('Run Route Extractor')).toBeDisabled()
  })

  it('calls onRun with params', () => {
    const onRun = vi.fn()
    render(<RoutExtractorForm sessionId="s1" onRun={onRun} />)
    fireEvent.change(screen.getByPlaceholderText('HERC01'), { target: { value: 'u' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'p' } })
    fireEvent.click(screen.getByText('Run Route Extractor'))
    expect(onRun).toHaveBeenCalledWith({ username: 'u', password: 'p', policyNumbers: [] })
  })

  it('respects disabled prop', () => {
    render(<RoutExtractorForm sessionId="s1" onRun={vi.fn()} disabled />)
    expect(screen.getByPlaceholderText('HERC01')).toBeDisabled()
  })
})
