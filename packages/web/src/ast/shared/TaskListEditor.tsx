import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

interface Task {
  id: string
  label: string
  value: string
}

interface TaskListEditorProps {
  tasks: Task[]
  onChange: (tasks: Task[]) => void
  placeholder?: string
  label?: string
  disabled?: boolean
}

export function TaskListEditor({
  tasks,
  onChange,
  placeholder = 'Enter value',
  label = 'Items',
  disabled,
}: TaskListEditorProps) {
  const [newValue, setNewValue] = useState('')

  const addTask = () => {
    if (!newValue.trim()) return
    const items = newValue
      .split(/[\n,;]+/)
      .map((v) => v.trim())
      .filter(Boolean)

    const newTasks = items.map((value) => ({
      id: crypto.randomUUID(),
      label: value,
      value,
    }))

    onChange([...tasks, ...newTasks])
    setNewValue('')
  }

  const removeTask = (id: string) => {
    onChange(tasks.filter((t) => t.id !== id))
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400">{label}</label>
      <div className="flex gap-2">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
          className="flex-1"
        />
        <Button onClick={addTask} variant="secondary" size="sm" disabled={disabled}>
          Add
        </Button>
      </div>
      {tasks.length > 0 && (
        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between rounded bg-gray-800 px-2 py-1 text-xs"
            >
              <span className="text-gray-300">{task.label}</span>
              <button
                onClick={() => removeTask(task.id)}
                className="text-gray-500 hover:text-red-400"
                disabled={disabled}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-1 text-[10px] text-gray-500">{tasks.length} items</p>
    </div>
  )
}
