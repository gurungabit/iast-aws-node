import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LoginASTForm } from './LoginASTForm'

Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'test-uuid' },
})

describe('LoginASTForm', () => {
  it('renders credentials inputs', () => {
    render(<LoginASTForm sessionId="s1" onRun={vi.fn()} />)
    expect(screen.getByPlaceholderText('HERC01')).toBeDefined()
    expect(screen.getByPlaceholderText('Password')).toBeDefined()
  })

  it('renders run button', () => {
    render(<LoginASTForm sessionId="s1" onRun={vi.fn()} />)
    expect(screen.getByText('Run Login AST')).toBeDefined()
  })

  it('run button disabled when no credentials', () => {
    render(<LoginASTForm sessionId="s1" onRun={vi.fn()} />)
    expect(screen.getByText('Run Login AST')).toBeDisabled()
  })

  it('run button enabled when credentials provided', () => {
    render(<LoginASTForm sessionId="s1" onRun={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('HERC01'), { target: { value: 'user' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass' } })
    expect(screen.getByText('Run Login AST')).not.toBeDisabled()
  })

  it('calls onRun with correct params', () => {
    const onRun = vi.fn()
    render(<LoginASTForm sessionId="s1" onRun={onRun} />)
    fireEvent.change(screen.getByPlaceholderText('HERC01'), { target: { value: 'myuser' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'mypass' } })
    fireEvent.click(screen.getByText('Run Login AST'))
    expect(onRun).toHaveBeenCalledWith({
      username: 'myuser',
      password: 'mypass',
      policyNumbers: [],
    })
  })

  it('respects disabled prop', () => {
    render(<LoginASTForm sessionId="s1" onRun={vi.fn()} disabled />)
    expect(screen.getByPlaceholderText('HERC01')).toBeDisabled()
    expect(screen.getByPlaceholderText('Password')).toBeDisabled()
  })
})
