import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskListEditor } from './TaskListEditor'

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2, 7) },
})

describe('TaskListEditor', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders label', () => {
    render(<TaskListEditor tasks={[]} onChange={mockOnChange} label="Policies" />)
    expect(screen.getByText('Policies')).toBeDefined()
  })

  it('renders default label "Items"', () => {
    render(<TaskListEditor tasks={[]} onChange={mockOnChange} />)
    expect(screen.getByText('Items')).toBeDefined()
  })

  it('renders placeholder on input', () => {
    render(<TaskListEditor tasks={[]} onChange={mockOnChange} placeholder="Enter policy" />)
    expect(screen.getByPlaceholderText('Enter policy')).toBeDefined()
  })

  it('shows item count', () => {
    const tasks = [{ id: '1', label: 'ABC', value: 'ABC' }]
    render(<TaskListEditor tasks={tasks} onChange={mockOnChange} />)
    expect(screen.getByText('1 items')).toBeDefined()
  })

  it('adds task when Add button clicked', () => {
    render(<TaskListEditor tasks={[]} onChange={mockOnChange} />)
    const input = screen.getByPlaceholderText('Enter value')
    fireEvent.change(input, { target: { value: 'NEW_ITEM' } })
    fireEvent.click(screen.getByText('Add'))
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ value: 'NEW_ITEM', label: 'NEW_ITEM' }),
      ]),
    )
  })

  it('adds task on Enter key', () => {
    render(<TaskListEditor tasks={[]} onChange={mockOnChange} />)
    const input = screen.getByPlaceholderText('Enter value')
    fireEvent.change(input, { target: { value: 'ENTER_ITEM' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnChange).toHaveBeenCalled()
  })

  it('splits comma-separated input', () => {
    render(<TaskListEditor tasks={[]} onChange={mockOnChange} />)
    const input = screen.getByPlaceholderText('Enter value')
    fireEvent.change(input, { target: { value: 'A,B,C' } })
    fireEvent.click(screen.getByText('Add'))
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ value: 'A' }),
        expect.objectContaining({ value: 'B' }),
        expect.objectContaining({ value: 'C' }),
      ]),
    )
  })

  it('does not add empty input', () => {
    render(<TaskListEditor tasks={[]} onChange={mockOnChange} />)
    fireEvent.click(screen.getByText('Add'))
    expect(mockOnChange).not.toHaveBeenCalled()
  })

  it('removes task when x clicked', () => {
    const tasks = [
      { id: '1', label: 'ABC', value: 'ABC' },
      { id: '2', label: 'DEF', value: 'DEF' },
    ]
    render(<TaskListEditor tasks={tasks} onChange={mockOnChange} />)
    const removeButtons = screen.getAllByText('×')
    fireEvent.click(removeButtons[0])
    expect(mockOnChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: '2', value: 'DEF' }),
    ])
  })

  it('respects disabled prop', () => {
    render(<TaskListEditor tasks={[]} onChange={mockOnChange} disabled />)
    const input = screen.getByPlaceholderText('Enter value')
    expect(input).toBeDisabled()
  })

  it('renders existing tasks', () => {
    const tasks = [{ id: '1', label: 'Task1', value: 'Task1' }]
    render(<TaskListEditor tasks={tasks} onChange={mockOnChange} />)
    expect(screen.getByText('Task1')).toBeDefined()
  })
})
