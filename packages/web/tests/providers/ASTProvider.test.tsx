import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ASTProvider } from '@src/providers/ASTProvider'

describe('ASTProvider', () => {
  it('renders children', () => {
    render(
      <ASTProvider>
        <div data-testid="child">Hello</div>
      </ASTProvider>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('renders multiple children', () => {
    render(
      <ASTProvider>
        <span>First</span>
        <span>Second</span>
        <span>Third</span>
      </ASTProvider>,
    )
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.getByText('Third')).toBeInTheDocument()
  })

  it('renders nested components', () => {
    render(
      <ASTProvider>
        <div>
          <p data-testid="nested">Nested content</p>
        </div>
      </ASTProvider>,
    )
    expect(screen.getByTestId('nested')).toBeInTheDocument()
  })

  it('renders text content directly', () => {
    render(<ASTProvider>Plain text</ASTProvider>)
    expect(screen.getByText('Plain text')).toBeInTheDocument()
  })

  it('passes through child props', () => {
    render(
      <ASTProvider>
        <input type="text" placeholder="test input" />
      </ASTProvider>,
    )
    expect(screen.getByPlaceholderText('test input')).toBeInTheDocument()
  })

  it('renders without adding extra DOM elements around children', () => {
    const { container } = render(
      <ASTProvider>
        <div data-testid="only-child">Content</div>
      </ASTProvider>,
    )
    // The ASTProvider uses a fragment, so the div should be a direct child of the container
    expect(container.firstElementChild).toBe(screen.getByTestId('only-child'))
  })

  it('renders complex component trees', () => {
    render(
      <ASTProvider>
        <header>
          <h1>Title</h1>
        </header>
        <main>
          <p>Body</p>
        </main>
        <footer>
          <span>Footer</span>
        </footer>
      </ASTProvider>,
    )
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })

  it('renders empty when no children provided', () => {
    const { container } = render(<ASTProvider>{undefined}</ASTProvider>)
    expect(container.innerHTML).toBe('')
  })
})
