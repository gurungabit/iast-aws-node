import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ItemResultList, type ASTItemResult } from './ItemResultList'

vi.mock('lucide-react', () => ({
  Circle: (props: Record<string, unknown>) => <div data-testid="icon-circle" {...props} />,
  Loader2: (props: Record<string, unknown>) => <div data-testid="icon-loader" {...props} />,
  Check: (props: Record<string, unknown>) => <div data-testid="icon-check" {...props} />,
  X: (props: Record<string, unknown>) => <div data-testid="icon-x" {...props} />,
  Ban: (props: Record<string, unknown>) => <div data-testid="icon-ban" {...props} />,
}))

describe('ItemResultList', () => {
  it('returns null for empty items array', () => {
    const { container } = render(<ItemResultList items={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders items with their IDs', () => {
    const items: ASTItemResult[] = [
      { itemId: 'item-1', status: 'success' },
      { itemId: 'item-2', status: 'failed' },
    ]
    render(<ItemResultList items={items} />)
    expect(screen.getByText('item-1')).toBeInTheDocument()
    expect(screen.getByText('item-2')).toBeInTheDocument()
  })

  it('renders correct icon for pending status', () => {
    const items: ASTItemResult[] = [{ itemId: 'pending-item', status: 'pending' }]
    render(<ItemResultList items={items} />)
    expect(screen.getByTestId('icon-circle')).toBeInTheDocument()
  })

  it('renders correct icon for running status', () => {
    const items: ASTItemResult[] = [{ itemId: 'running-item', status: 'running' }]
    render(<ItemResultList items={items} />)
    expect(screen.getByTestId('icon-loader')).toBeInTheDocument()
  })

  it('renders correct icon for success status', () => {
    const items: ASTItemResult[] = [{ itemId: 'success-item', status: 'success' }]
    render(<ItemResultList items={items} />)
    expect(screen.getByTestId('icon-check')).toBeInTheDocument()
  })

  it('renders correct icon for failed status', () => {
    const items: ASTItemResult[] = [{ itemId: 'failed-item', status: 'failed' }]
    render(<ItemResultList items={items} />)
    expect(screen.getByTestId('icon-x')).toBeInTheDocument()
  })

  it('renders correct icon for skipped status', () => {
    const items: ASTItemResult[] = [{ itemId: 'skipped-item', status: 'skipped' }]
    render(<ItemResultList items={items} />)
    expect(screen.getByTestId('icon-ban')).toBeInTheDocument()
  })

  it('renders duration when provided', () => {
    const items: ASTItemResult[] = [{ itemId: 'item-1', status: 'success', durationMs: 1234 }]
    render(<ItemResultList items={items} />)
    expect(screen.getByText('1234ms')).toBeInTheDocument()
  })

  it('does not render duration when not provided', () => {
    const items: ASTItemResult[] = [{ itemId: 'item-1', status: 'success' }]
    render(<ItemResultList items={items} />)
    expect(screen.queryByText(/ms$/)).not.toBeInTheDocument()
  })

  it('renders error message when present', () => {
    const items: ASTItemResult[] = [{ itemId: 'item-1', status: 'failed', error: 'Connection refused' }]
    render(<ItemResultList items={items} />)
    expect(screen.getByText('Connection refused')).toBeInTheDocument()
  })

  it('does not render error when not present', () => {
    const items: ASTItemResult[] = [{ itemId: 'item-1', status: 'success' }]
    const { container } = render(<ItemResultList items={items} />)
    const errorElements = container.querySelectorAll('.text-red-600')
    expect(errorElements.length).toBe(0)
  })

  it('applies correct status color classes', () => {
    const items: ASTItemResult[] = [
      { itemId: 'success-item', status: 'success' },
      { itemId: 'failed-item', status: 'failed' },
    ]
    const { container } = render(<ItemResultList items={items} />)
    expect(container.querySelector('.bg-green-100')).toBeInTheDocument()
    expect(container.querySelector('.bg-red-100')).toBeInTheDocument()
  })

  it('applies default maxHeight', () => {
    const items: ASTItemResult[] = [{ itemId: 'item', status: 'pending' }]
    const { container } = render(<ItemResultList items={items} />)
    expect(container.firstElementChild!.getAttribute('style')).toContain('max-height: 200px')
  })

  it('applies custom maxHeight', () => {
    const items: ASTItemResult[] = [{ itemId: 'item', status: 'pending' }]
    const { container } = render(<ItemResultList items={items} maxHeight="400px" />)
    expect(container.firstElementChild!.getAttribute('style')).toContain('max-height: 400px')
  })

  it('applies custom className', () => {
    const items: ASTItemResult[] = [{ itemId: 'item', status: 'pending' }]
    const { container } = render(<ItemResultList items={items} className="my-list" />)
    expect(container.firstElementChild!.className).toContain('my-list')
  })
})
