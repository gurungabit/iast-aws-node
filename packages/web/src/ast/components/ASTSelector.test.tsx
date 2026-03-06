import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../registry', () => ({
  getAllASTs: vi.fn().mockReturnValue([
    { name: 'login', label: 'Login', description: 'TSO Login' },
    { name: 'bi-renew', label: 'BI Renew', description: 'BI Renewal' },
  ]),
}))

import { ASTSelector } from './ASTSelector'

describe('ASTSelector', () => {
  it('renders trigger button with placeholder', () => {
    render(<ASTSelector selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText('Search for an AST...')).toBeDefined()
  })

  it('shows dropdown when clicked', () => {
    render(<ASTSelector selected={null} onSelect={vi.fn()} />)
    fireEvent.click(screen.getByText('Search for an AST...'))
    expect(screen.getByText('Login')).toBeDefined()
    expect(screen.getByText('BI Renew')).toBeDefined()
  })

  it('calls onSelect when option clicked', () => {
    const onSelect = vi.fn()
    render(<ASTSelector selected={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Search for an AST...'))
    fireEvent.click(screen.getByText('Login'))
    expect(onSelect).toHaveBeenCalledWith('login')
  })

  it('shows selected AST label in trigger', () => {
    render(<ASTSelector selected="login" onSelect={vi.fn()} />)
    expect(screen.getByText('Login')).toBeDefined()
  })

  it('filters results based on search', () => {
    render(<ASTSelector selected={null} onSelect={vi.fn()} />)
    fireEvent.click(screen.getByText('Search for an AST...'))
    const searchInput = screen.getByPlaceholderText('Search...')
    fireEvent.change(searchInput, { target: { value: 'renew' } })
    expect(screen.getByText('BI Renew')).toBeDefined()
    expect(screen.queryByText('Login')).toBeNull()
  })
})
