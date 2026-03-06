import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskListEditor } from './TaskListEditor'
import type { AstConfigTask } from '../types'

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2, 7) },
})

// Mock dnd-kit since it requires browser APIs not available in jsdom
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  closestCenter: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn().mockReturnValue([]),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  arrayMove: vi.fn((arr: unknown[], from: number, to: number) => {
    const result = [...arr]
    const [item] = result.splice(from, 1)
    result.splice(to, 0, item)
    return result
  }),
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

describe('TaskListEditor', () => {
  const mockOnChange = vi.fn()
  const mockRenderTaskInputs = vi.fn(
    (task: AstConfigTask, _onParamsChange: (params: Record<string, unknown>) => void) => (
      <div data-testid={`task-inputs-${task.taskId}`}>Task params</div>
    ),
  )
  const mockGetDefaultTaskParams = vi.fn().mockReturnValue({ policyInput: '' })

  const defaultProps = {
    tasks: [] as AstConfigTask[],
    onChange: mockOnChange,
    renderTaskInputs: mockRenderTaskInputs,
    getDefaultTaskParams: mockGetDefaultTaskParams,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with task count header', () => {
    render(<TaskListEditor {...defaultProps} />)
    expect(screen.getByText('Tasks (0)')).toBeDefined()
  })

  it('shows empty state when no tasks', () => {
    render(<TaskListEditor {...defaultProps} />)
    expect(screen.getByText(/No tasks yet/)).toBeDefined()
  })

  it('shows Add Task button', () => {
    render(<TaskListEditor {...defaultProps} />)
    expect(screen.getByText('Add Task')).toBeDefined()
  })

  it('calls onChange with new task when Add Task is clicked', () => {
    render(<TaskListEditor {...defaultProps} />)
    fireEvent.click(screen.getByText('Add Task'))
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          order: 0,
          description: '',
          params: { policyInput: '' },
        }),
      ]),
    )
    expect(mockGetDefaultTaskParams).toHaveBeenCalled()
  })

  it('renders existing tasks with task numbers', () => {
    const tasks: AstConfigTask[] = [
      { taskId: 'task-1', order: 0, description: 'First task', params: { policyInput: 'ABC' } },
      { taskId: 'task-2', order: 1, description: 'Second task', params: { policyInput: 'DEF' } },
    ]
    render(<TaskListEditor {...defaultProps} tasks={tasks} />)
    expect(screen.getByText('Tasks (2)')).toBeDefined()
    expect(screen.getByText('First task')).toBeDefined()
    expect(screen.getByText('Second task')).toBeDefined()
  })

  it('shows task count in header', () => {
    const tasks: AstConfigTask[] = [
      { taskId: 'task-1', order: 0, description: '', params: {} },
    ]
    render(<TaskListEditor {...defaultProps} tasks={tasks} />)
    expect(screen.getByText('Tasks (1)')).toBeDefined()
  })

  it('disables Add Task button when disabled', () => {
    render(<TaskListEditor {...defaultProps} disabled />)
    expect(screen.getByText('Add Task').closest('button')).toBeDisabled()
  })
})
