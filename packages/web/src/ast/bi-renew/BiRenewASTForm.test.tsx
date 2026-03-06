import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BiRenewASTForm } from './BiRenewASTForm'

Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'test-uuid' },
})

describe('BiRenewASTForm', () => {
  it('renders credentials and run button', () => {
    render(<BiRenewASTForm sessionId="s1" onRun={vi.fn()} />)
    expect(screen.getByPlaceholderText('HERC01')).toBeDefined()
    expect(screen.getByPlaceholderText('Password')).toBeDefined()
    expect(screen.getByText('Run BI Renew')).toBeDefined()
  })

  it('run button disabled without credentials', () => {
    render(<BiRenewASTForm sessionId="s1" onRun={vi.fn()} />)
    expect(screen.getByText('Run BI Renew')).toBeDisabled()
  })

  it('calls onRun with params', () => {
    const onRun = vi.fn()
    render(<BiRenewASTForm sessionId="s1" onRun={onRun} />)
    fireEvent.change(screen.getByPlaceholderText('HERC01'), { target: { value: 'u' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'p' } })
    fireEvent.click(screen.getByText('Run BI Renew'))
    expect(onRun).toHaveBeenCalledWith({ username: 'u', password: 'p', policyNumbers: [] })
  })

  it('respects disabled prop', () => {
    render(<BiRenewASTForm sessionId="s1" onRun={vi.fn()} disabled />)
    expect(screen.getByPlaceholderText('HERC01')).toBeDisabled()
  })
})
