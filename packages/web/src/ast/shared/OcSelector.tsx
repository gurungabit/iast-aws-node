import { useState, useRef, useEffect, useMemo } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { OC_OPTIONS } from './oc'

interface OcSelectorProps {
  value: string
  onChange: (code: string) => void
  placeholder?: string
  disabled?: boolean
}

function matchesQuery(option: { label: string; code: string }, query: string): boolean {
  if (!query) return true
  const q = query.trim().toLowerCase()
  if (!q) return true
  return option.label.toLowerCase().includes(q) || option.code.toLowerCase().includes(q)
}

export function OcSelector({
  value,
  onChange,
  placeholder = 'Select OC...',
  disabled = false,
}: OcSelectorProps): React.ReactNode {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedOption = useMemo(() => {
    if (!value) return null
    return OC_OPTIONS.find((o) => o.code === value) ?? null
  }, [value])

  const filtered = useMemo(
    () => OC_OPTIONS.filter((o) => matchesQuery(o, searchQuery)),
    [searchQuery],
  )

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }
  }, [isOpen])

  function handleToggle() {
    if (disabled) return
    const wasOpen = isOpen
    setIsOpen(!wasOpen)
    if (wasOpen) {
      setSearchQuery('')
      setHighlightedIndex(-1)
    }
  }

  function handleSelect(code: string) {
    onChange(code)
    setIsOpen(false)
    setSearchQuery('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setIsOpen(false)
    setSearchQuery('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
          handleSelect(filtered[highlightedIndex].code)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSearchQuery('')
        break
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={
          `w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left ` +
          (disabled
            ? 'bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 cursor-not-allowed opacity-60'
            : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 cursor-pointer hover:border-gray-400 dark:hover:border-zinc-600')
        }
      >
        <Search className="w-4 h-4 text-gray-400 dark:text-zinc-500 flex-shrink-0" />
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {selectedOption ? (
            <>
              <span className="text-sm text-gray-900 dark:text-zinc-100 truncate">
                {selectedOption.label}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 flex-shrink-0">
                {selectedOption.code}
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-400 dark:text-zinc-500">{placeholder}</span>
          )}
        </div>
        {selectedOption && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleClear(e as unknown as React.MouseEvent)
            }}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
            aria-label="Clear OC"
            title="Clear"
          >
            <X className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 dark:text-zinc-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400 dark:text-zinc-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setHighlightedIndex(-1)
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search OC..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-sm text-gray-500 dark:text-zinc-500 text-center">
                No matches
              </div>
            ) : (
              filtered.map((opt, idx) => {
                const isHighlighted = idx === highlightedIndex
                const isSelected = opt.code === value
                return (
                  <div
                    key={opt.code}
                    onClick={() => handleSelect(opt.code)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={
                      `flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ` +
                      (isHighlighted
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50') +
                      (isSelected ? ' bg-blue-100 dark:bg-blue-900/30' : '')
                    }
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                          {opt.label}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 flex-shrink-0">
                          {opt.code}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
