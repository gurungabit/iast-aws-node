import type { ReactNode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}))

const mockLogout = vi.fn()
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { email: 'test@example.com' }, logout: mockLogout }),
}))

const mockToggleTheme = vi.fn()
vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: mockToggleTheme }),
}))

vi.mock('./ThemeToggle', () => ({
  ThemeToggle: ({ theme, onToggle }: { theme: 'light' | 'dark'; onToggle: () => void }) => (
    <button data-testid="theme-toggle" onClick={onToggle}>
      {theme}
    </button>
  ),
}))

vi.mock('./UserDropdown', () => ({
  UserDropdown: ({ email, onSignOut }: { email: string; onSignOut: () => void }) => (
    <span data-testid="user-dropdown" onClick={onSignOut}>
      {email}
    </span>
  ),
}))

import { Navbar } from './Navbar'

describe('Navbar', () => {
  it('renders the title "TN3270 Terminal"', () => {
    render(<Navbar />)
    expect(screen.getByText('TN3270 Terminal')).toBeInTheDocument()
  })

  it('renders a header element', () => {
    render(<Navbar />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('renders nav element', () => {
    render(<Navbar />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('renders Terminal link pointing to "/"', () => {
    render(<Navbar />)
    const link = screen.getByText('Terminal')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/')
  })

  it('renders History link pointing to "/history"', () => {
    render(<Navbar />)
    const link = screen.getByText('History')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/history')
  })

  it('renders Schedules link pointing to "/schedules"', () => {
    render(<Navbar />)
    const link = screen.getByText('Schedules')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/schedules')
  })

  it('renders AutoLauncher Runs link pointing to "/auto-launcher-runs"', () => {
    render(<Navbar />)
    const link = screen.getByText('AutoLauncher Runs')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/auto-launcher-runs')
  })

  it('renders exactly 4 navigation links', () => {
    render(<Navbar />)
    const nav = screen.getByRole('navigation')
    const links = nav.querySelectorAll('a')
    expect(links).toHaveLength(4)
  })

  it('renders ThemeToggle with current theme', () => {
    render(<Navbar />)
    const toggle = screen.getByTestId('theme-toggle')
    expect(toggle).toBeInTheDocument()
    expect(toggle).toHaveTextContent('dark')
  })

  it('renders UserDropdown with user email', () => {
    render(<Navbar />)
    const dropdown = screen.getByTestId('user-dropdown')
    expect(dropdown).toBeInTheDocument()
    expect(dropdown).toHaveTextContent('test@example.com')
  })

  it('title has correct styling classes', () => {
    render(<Navbar />)
    const title = screen.getByText('TN3270 Terminal')
    expect(title.className).toContain('font-semibold')
  })

  it('calls logout when sign out is clicked', () => {
    render(<Navbar />)
    fireEvent.click(screen.getByTestId('user-dropdown'))
    expect(mockLogout).toHaveBeenCalled()
  })

  it('nav links have consistent styling', () => {
    render(<Navbar />)
    const links = screen.getByRole('navigation').querySelectorAll('a')
    links.forEach((link) => {
      expect(link.className).toContain('text-sm')
      expect(link.className).toContain('rounded-md')
    })
  })
})
