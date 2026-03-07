import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, X, Search } from 'lucide-react'
import { cn } from '../../utils'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchable?: boolean
  clearable?: boolean
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md'
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchable = true,
  clearable = true,
  disabled = false,
  className,
  size = 'md',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    if (!search) return options
    const q = search.toLowerCase()
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    )
  }, [options, search])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || highlightIdx < 0) return
    const list = listRef.current
    if (!list) return
    const item = list.children[highlightIdx] as HTMLElement | undefined
    item?.scrollIntoView?.({ block: 'nearest' })
  }, [highlightIdx, open])

  function openDropdown() {
    if (disabled) return
    setOpen(true)
    setSearch('')
    setHighlightIdx(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function selectOption(opt: SelectOption) {
    onChange(opt.value)
    setOpen(false)
    setSearch('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setSearch('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        openDropdown()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIdx((i) => (i < filtered.length - 1 ? i + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIdx((i) => (i > 0 ? i - 1 : filtered.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[highlightIdx]) selectOption(filtered[highlightIdx])
        break
      case 'Escape':
        setOpen(false)
        setSearch('')
        break
    }
  }

  const isSm = size === 'sm'

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => (open ? (setOpen(false), setSearch('')) : openDropdown())}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between rounded-md border transition-colors',
          'bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100',
          'border-gray-300 dark:border-zinc-600',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/40',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isSm ? 'px-2 py-1.5 text-sm' : 'px-3 py-2 text-sm',
          open && 'ring-2 ring-blue-500/40 border-blue-500',
        )}
      >
        <span className={cn('truncate text-left', !selected && 'text-gray-400 dark:text-zinc-500')}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 ml-2 flex-shrink-0">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <X className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-gray-400 dark:text-zinc-500 transition-transform',
              open && 'rotate-180',
            )}
          />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg">
          {/* Search input */}
          {searchable && (
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-100 dark:border-zinc-700">
              <Search className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setHighlightIdx(0)
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="w-full bg-transparent text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none"
              />
            </div>
          )}

          {/* Options list */}
          <div ref={listRef} className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400 dark:text-zinc-500">No results</div>
            ) : (
              filtered.map((opt, idx) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectOption(opt)}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  className={cn(
                    'w-full text-left px-3 text-sm cursor-pointer transition-colors',
                    isSm ? 'py-1' : 'py-1.5',
                    opt.value === value
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-zinc-300',
                    idx === highlightIdx && opt.value !== value && 'bg-gray-50 dark:bg-zinc-700/50',
                  )}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
