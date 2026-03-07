import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, Copy, GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import type { AstConfigTask } from '../types'

export interface TaskListEditorProps {
  tasks: AstConfigTask[]
  onChange: (tasks: AstConfigTask[]) => void
  renderTaskInputs: (
    task: AstConfigTask,
    onParamsChange: (params: Record<string, unknown>) => void,
  ) => ReactNode
  getDefaultTaskParams: () => Record<string, unknown>
  disabled?: boolean
}

function SortableTaskRow(props: {
  task: AstConfigTask
  index: number
  isExpanded: boolean
  onToggleExpand: () => void
  onDescriptionChange: (description: string) => void
  onParamsChange: (params: Record<string, unknown>) => void
  onDuplicate: () => void
  onRemove: () => void
  renderTaskInputs: (
    task: AstConfigTask,
    onParamsChange: (params: Record<string, unknown>) => void,
  ) => ReactNode
  disabled?: boolean
  canRemove: boolean
}): React.ReactNode {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.taskId,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-gray-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800/50"
    >
      <div className="flex items-center gap-2 p-2">
        <div
          className="text-gray-400 dark:text-zinc-500 cursor-grab active:cursor-grabbing shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <button
          type="button"
          className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer text-left"
          onClick={props.onToggleExpand}
        >
          <span className="text-gray-500 dark:text-zinc-400 shrink-0">
            {props.isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>
          <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 shrink-0">
            #{props.index + 1}
          </span>
          <span className="text-sm text-gray-900 dark:text-zinc-100 truncate">
            {props.task.description || `Task ${props.index + 1}`}
          </span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            title="Duplicate task"
            className="p-1 rounded cursor-pointer text-zinc-400 hover:text-blue-500 hover:bg-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={props.onDuplicate}
            disabled={props.disabled}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {props.canRemove && (
            <button
              type="button"
              title="Remove task"
              className="p-1 rounded cursor-pointer text-zinc-400 hover:text-red-500 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={props.onRemove}
              disabled={props.disabled}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {props.isExpanded && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-100 dark:border-zinc-700/50 space-y-2">
          <div className="max-w-xs">
            <label
              htmlFor={`task-desc-${props.task.taskId}`}
              className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1"
            >
              Description
            </label>
            <Input
              id={`task-desc-${props.task.taskId}`}
              value={props.task.description}
              onChange={(e) => props.onDescriptionChange(e.target.value)}
              placeholder="Task description..."
              disabled={props.disabled}
              className="text-sm"
            />
          </div>
          {props.renderTaskInputs(props.task, props.onParamsChange)}
        </div>
      )}
    </div>
  )
}

export function TaskListEditor({
  tasks,
  onChange,
  renderTaskInputs,
  getDefaultTaskParams,
  disabled = false,
}: TaskListEditorProps): React.ReactNode {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function toggleExpand(taskId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = tasks.findIndex((t) => t.taskId === String(active.id))
    const newIndex = tasks.findIndex((t) => t.taskId === String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(tasks, oldIndex, newIndex).map((t, i) => ({ ...t, order: i }))
    onChange(reordered)
  }

  function addTask() {
    const newTask: AstConfigTask = {
      taskId: crypto.randomUUID(),
      order: tasks.length,
      description: '',
      params: getDefaultTaskParams(),
    }
    onChange([...tasks, newTask])
    setExpandedIds((prev) => new Set(prev).add(newTask.taskId))
  }

  function duplicateTask(sourceTask: AstConfigTask) {
    const newTask: AstConfigTask = {
      taskId: crypto.randomUUID(),
      order: tasks.length,
      description: sourceTask.description ? `${sourceTask.description} (copy)` : '',
      params: { ...sourceTask.params },
    }
    onChange([...tasks, newTask])
    setExpandedIds((prev) => new Set(prev).add(newTask.taskId))
  }

  function removeTask(taskId: string) {
    const filtered = tasks.filter((t) => t.taskId !== taskId).map((t, i) => ({ ...t, order: i }))
    onChange(filtered)
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })
  }

  function updateDescription(taskId: string, description: string) {
    onChange(tasks.map((t) => (t.taskId === taskId ? { ...t, description } : t)))
  }

  function updateParams(taskId: string, params: Record<string, unknown>) {
    onChange(tasks.map((t) => (t.taskId === taskId ? { ...t, params } : t)))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 dark:text-zinc-300">
          Tasks ({tasks.length})
        </h4>
        <Button type="button" variant="secondary" size="sm" onClick={addTask} disabled={disabled}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-6 text-sm text-gray-500 dark:text-zinc-500 border border-dashed border-gray-300 dark:border-zinc-700 rounded-md">
          No tasks yet. Click &quot;Add Task&quot; to create one.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={tasks.map((t) => t.taskId)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {tasks.map((task, idx) => (
                <SortableTaskRow
                  key={task.taskId}
                  task={task}
                  index={idx}
                  isExpanded={expandedIds.has(task.taskId)}
                  onToggleExpand={() => toggleExpand(task.taskId)}
                  onDescriptionChange={(desc) => updateDescription(task.taskId, desc)}
                  onParamsChange={(params) => updateParams(task.taskId, params)}
                  onDuplicate={() => duplicateTask(task)}
                  onRemove={() => removeTask(task.taskId)}
                  renderTaskInputs={renderTaskInputs}
                  disabled={disabled}
                  canRemove={tasks.length > 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
