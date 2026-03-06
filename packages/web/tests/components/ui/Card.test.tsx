import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '@src/components/ui/Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('renders title', () => {
    render(<Card title="Card Title">Content</Card>)
    expect(screen.getByText('Card Title')).toBeInTheDocument()
  })

  it('renders description', () => {
    render(<Card description="Card description">Content</Card>)
    expect(screen.getByText('Card description')).toBeInTheDocument()
  })

  it('renders title and description together', () => {
    render(
      <Card title="Title" description="Desc">
        Content
      </Card>,
    )
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Desc')).toBeInTheDocument()
  })

  it('renders footer', () => {
    render(<Card footer={<button>Save</button>}>Content</Card>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('does not render header when no title or description', () => {
    const { container } = render(<Card>Content</Card>)
    const borderBElements = container.querySelectorAll('.border-b')
    expect(borderBElements.length).toBe(0)
  })

  it('does not render footer when no footer prop', () => {
    const { container } = render(<Card>Content</Card>)
    const borderTElements = container.querySelectorAll('.border-t')
    expect(borderTElements.length).toBe(0)
  })

  it('applies padding by default', () => {
    const { container } = render(<Card>Content</Card>)
    // The content wrapper should have p-4
    const contentWrapper = container.querySelector('.p-4')
    expect(contentWrapper).toBeInTheDocument()
  })

  it('removes padding when noPadding is true', () => {
    const { container } = render(<Card noPadding>Content</Card>)
    // The content wrapper should NOT have p-4
    const contentWrappers = container.querySelectorAll('.p-4')
    expect(contentWrappers.length).toBe(0)
  })

  it('applies custom className', () => {
    const { container } = render(<Card className="my-class">Content</Card>)
    expect(container.firstElementChild!.className).toContain('my-class')
  })
})
