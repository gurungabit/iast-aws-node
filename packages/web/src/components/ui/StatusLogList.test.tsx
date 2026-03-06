import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusLogList } from './StatusLogList'

describe('StatusLogList', () => {
  it('returns null for empty messages array', () => {
    const { container } = render(<StatusLogList messages={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders messages', () => {
    render(<StatusLogList messages={['First message', 'Second message']} />)
    expect(screen.getByText('First message')).toBeInTheDocument()
    expect(screen.getByText('Second message')).toBeInTheDocument()
  })

  it('renders line numbers starting from 1', () => {
    render(<StatusLogList messages={['Message A', 'Message B', 'Message C']} />)
    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('2.')).toBeInTheDocument()
    expect(screen.getByText('3.')).toBeInTheDocument()
  })

  it('applies default maxHeight', () => {
    const { container } = render(<StatusLogList messages={['msg']} />)
    const listEl = container.firstElementChild!
    expect(listEl.getAttribute('style')).toContain('max-height: 120px')
  })

  it('applies custom maxHeight', () => {
    const { container } = render(<StatusLogList messages={['msg']} maxHeight="200px" />)
    const listEl = container.firstElementChild!
    expect(listEl.getAttribute('style')).toContain('max-height: 200px')
  })

  it('applies custom className', () => {
    const { container } = render(<StatusLogList messages={['msg']} className="custom" />)
    expect(container.firstElementChild!.className).toContain('custom')
  })

  it('renders a single message correctly', () => {
    render(<StatusLogList messages={['Only one']} />)
    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('Only one')).toBeInTheDocument()
  })

  it('renders many messages', () => {
    const messages = Array.from({ length: 50 }, (_, i) => `Message ${i + 1}`)
    render(<StatusLogList messages={messages} />)
    expect(screen.getByText('Message 1')).toBeInTheDocument()
    expect(screen.getByText('Message 50')).toBeInTheDocument()
    expect(screen.getByText('50.')).toBeInTheDocument()
  })
})
