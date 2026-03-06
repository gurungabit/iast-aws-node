import { useState, useRef, useEffect, useMemo } from 'react'
import { Check, ChevronDown, Search, Trash2, X } from 'lucide-react'
import type { SavedAstConfigWithAccess } from '../types'

interface AstConfigSelectorProps {
  value: string | null
  configs: ReadonlyArray<SavedAstConfigWithAccess>
  onChange: (configId: string | null) => void
  onDelete?: (configId: string) => void
  placeholder?: string
  disabled?: boolean
}

function matchesQuery(config: SavedAstConfigWithAccess, query: string): boolean {
  if (!query) return true
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    config.configurationName.toLowerCase().includes(q) ||
    config.oc.toLowerCase().includes(q) ||
    config.ownerAlias.toLowerCase().includes(q) ||
    (config.visibility === 'public' && 'public'.includes(q))
  )
}

export function AstConfigSelector({
  value,
  configs,
  onChange,
  onDelete,
  placeholder = 'Select Config',
  disabled = false,
}: AstConfigSelectorProps): React.ReactNode {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedConfig = useMemo(() => {
    if (!value) return null
    return configs.find((c) => c.configId === value) ?? null
  }, [configs, value])

  const myConfigs = useMemo(() => configs.filter((c) => c.isOwner), [configs])
  const publicConfigs = useMemo(
    () => configs.filter((c) => !c.isOwner && c.visibility === 'public'),
    [configs],
  )

  const filteredMy = useMemo(
    () => myConfigs.filter((c) => matchesQuery(c, searchQuery)),
    [myConfigs, searchQuery],
  )
  const filteredPublic = useMemo(
    () => publicConfigs.filter((c) => matchesQuery(c, searchQuery)),
    [publicConfigs, searchQuery],
  )

  const flatResults = useMemo(() => {
    if (!searchQuery.trim()) return [...filteredMy, ...filteredPublic]
    return [...filteredMy, ...filteredPublic].sort((a, b) =>
      a.configurationName.localeCompare(b.configurationName),
    )
  }, [filteredMy, filteredPublic, searchQuery])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
        setConfirmDeleteId(null)
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
    if (wasOpen) setSearchQuery('')
  }

  function handleSelect(configId: string | null) {
    onChange(configId)
    setIsOpen(false)
    setSearchQuery('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    handleSelect(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((i) => Math.min(i + 1, flatResults.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && flatResults[highlightedIndex]) {
          handleSelect(flatResults[highlightedIndex].configId)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSearchQuery('')
        break
    }
  }

  function renderOption(cfg: SavedAstConfigWithAccess, index: number) {
    const isHighlighted = index === highlightedIndex
    const isSelected = cfg.configId === value
    const isPendingDelete = confirmDeleteId === cfg.configId

    if (isPendingDelete && onDelete) {
      return (
        <div
          key={cfg.configId}
          className="flex items-center justify-between gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border-y border-red-200 dark:border-red-800/40"
        >
          <p className="text-xs text-gray-700 dark:text-zinc-300 truncate">
            Delete <strong className="text-gray-900 dark:text-zinc-100">{cfg.configurationName}</strong>?
          </p>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }}
              className="px-2 py-0.5 text-xs rounded bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-600 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); onDelete(cfg.configId) }}
              className="px-2 py-0.5 text-xs rounded bg-red-500 text-white hover:bg-red-600 cursor-pointer transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )
    }

    return (
      <div
        key={cfg.configId}
        onClick={() => handleSelect(cfg.configId)}
        onMouseEnter={() => setHighlightedIndex(index)}
        className={`
          flex items-start gap-3 px-3 py-2 cursor-pointer transition-colors
          ${isHighlighted ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'}
          ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''}
        `}
      >
        <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-bold text-gray-500 dark:text-zinc-500">
            {cfg.configurationName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
              {cfg.configurationName}
            </span>
            {cfg.visibility === 'public' && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 flex-shrink-0">
                Public
              </span>
            )}
            {cfg.multiTask && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex-shrink-0">
                Multi-task
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">
            OC {cfg.oc}
            {cfg.visibility === 'public' && cfg.ownerAlias && (
              <span> &middot; by {cfg.ownerAlias.toUpperCase()}</span>
            )}
            {cfg.multiTask && cfg.tasks && cfg.tasks.length > 0 && (
              <span> &middot; {String(cfg.tasks.length)} tasks</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-1">
          {isSelected && <Check className="w-4 h-4 text-blue-500" />}
          {cfg.isOwner && onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(cfg.configId) }}
              className="p-0.5 text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
              title="Delete config"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    )
  }

  function renderGroupedResults() {
    let flatIndex = 0
    const sections: Array<{ title: string; items: SavedAstConfigWithAccess[] }> = []
    if (filteredMy.length > 0) sections.push({ title: 'My Configs', items: filteredMy })
    if (filteredPublic.length > 0) sections.push({ title: 'Public Configs', items: filteredPublic })

    return sections.map((section) => {
      const nodes = section.items.map((cfg) => {
        const idx = flatIndex++
        return renderOption(cfg, idx)
      })
      return (
        <div key={section.title}>
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800/50 sticky top-0">
            {section.title}
          </div>
          {nodes}
        </div>
      )
    })
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left
          ${disabled
            ? 'bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 cursor-not-allowed opacity-60'
            : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 cursor-pointer hover:border-gray-400 dark:hover:border-zinc-600'}
          ${isOpen ? 'border-blue-500 dark:border-blue-500 ring-1 ring-blue-500/20' : ''}
        `}
      >
        <Search className="w-4 h-4 text-gray-400 dark:text-zinc-500 flex-shrink-0" />
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {selectedConfig ? (
            <>
              <span className="text-sm text-gray-900 dark:text-zinc-100 truncate">
                {selectedConfig.configurationName}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 flex-shrink-0">
                OC {selectedConfig.oc}
              </span>
              {selectedConfig.multiTask && selectedConfig.tasks && selectedConfig.tasks.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex-shrink-0">
                  {String(selectedConfig.tasks.length)} tasks
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-gray-400 dark:text-zinc-500">{placeholder}</span>
          )}
        </div>
        {selectedConfig && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleClear(e as unknown as React.MouseEvent)
            }}
            className="p-0.5 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 dark:text-zinc-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setHighlightedIndex(-1)
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500"
              />
            </div>
          </div>
          <div className="max-h-[280px] overflow-auto" onMouseLeave={() => setHighlightedIndex(-1)}>
            {flatResults.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-zinc-500">
                No configs found{searchQuery && ` matching "${searchQuery}"`}
              </div>
            ) : !searchQuery.trim() ? (
              renderGroupedResults()
            ) : (
              flatResults.map((cfg, index) => renderOption(cfg, index))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
