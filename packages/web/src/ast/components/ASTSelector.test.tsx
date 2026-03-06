import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../registry', () => ({
  getAllASTs: vi.fn().mockReturnValue([
    { name: 'login', label: 'Login' },
    { name: 'bi-renew', label: 'BI Renew' },
  ]),
}))

import { ASTSelector } from './ASTSelector'

describe('ASTSelector', () => {
  it('renders AST buttons', () => {
    render(<ASTSelector selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText('Login')).toBeDefined()
    expect(screen.getByText('BI Renew')).toBeDefined()
  })

  it('calls onSelect when button clicked', () => {
    const onSelect = vi.fn()
    render(<ASTSelector selected={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Login'))
    expect(onSelect).toHaveBeenCalledWith('login')
  })

  it('highlights selected AST', () => {
    render(<ASTSelector selected="login" onSelect={vi.fn()} />)
    const loginBtn = screen.getByText('Login')
    expect(loginBtn.className).toContain('bg-blue-600')
  })
})
