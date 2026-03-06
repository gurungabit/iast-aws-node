import { useState, useRef, useEffect } from 'react'
import { Search, X, ChevronDown, Check } from 'lucide-react'
import { useASTRegistry } from '../registry'
import { CATEGORY_INFO } from '../registry/types'
import type { ASTConfig, ASTCategory } from '../registry/types'

interface ASTSelectorProps {
  value: string | null
  onChange: (id: string | null) => void
  placeholder?: string
  disabled?: boolean
  groupByCategory?: boolean
}

export function ASTSelector({
  value,
  onChange,
  placeholder = 'Select Automation',
  disabled = false,
  groupByCategory = true,
}: ASTSelectorProps): React.ReactNode {
  const { searchResults, searchQuery, setSearchQuery, getAST, groupedASTs } = useASTRegistry()

  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedAST = value ? getAST(value) : null

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setSearchQuery])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }
  }, [isOpen])

  useEffect(() => {
    setHighlightedIndex(-1)
  }, [searchQuery])

  function handleToggle() {
    if (disabled) return
    if (isOpen) setSearchQuery('')
    setIsOpen(!isOpen)
  }

  function handleSelect(ast: ASTConfig) {
    onChange(ast.id)
    setIsOpen(false)
    setSearchQuery('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
    setSearchQuery('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const results = searchResults
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((i) => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          handleSelect(results[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSearchQuery('')
        break
    }
  }

  function renderGroupedResults() {
    const categories = Object.keys(groupedASTs) as ASTCategory[]
    let flatIndex = 0

    return categories.map((category) => {
      const asts = groupedASTs[category].filter((ast) =>
        searchQuery ? searchResults.includes(ast) : true,
      )
      if (asts.length === 0) return null

      return (
        <div key={category}>
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800/50 sticky top-0">
            {CATEGORY_INFO[category].name}
          </div>
          {asts.map((ast) => {
            const index = flatIndex++
            return (
              <ASTOption
                key={ast.id}
                ast={ast}
                isHighlighted={index === highlightedIndex}
                isSelected={ast.id === value}
                onClick={() => handleSelect(ast)}
                onMouseEnter={() => setHighlightedIndex(index)}
              />
            )
          })}
        </div>
      )
    })
  }

  function renderFlatResults() {
    return searchResults.map((ast, index) => (
      <ASTOption
        key={ast.id}
        ast={ast}
        isHighlighted={index === highlightedIndex}
        isSelected={ast.id === value}
        onClick={() => handleSelect(ast)}
        onMouseEnter={() => setHighlightedIndex(index)}
      />
    ))
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left
          ${
            disabled
              ? 'bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 cursor-not-allowed opacity-60'
              : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 cursor-pointer hover:border-gray-400 dark:hover:border-zinc-600'
          }
          ${isOpen ? 'border-blue-500 dark:border-blue-500 ring-1 ring-blue-500/20' : ''}
        `}
      >
        <Search className="w-4 h-4 text-gray-400 dark:text-zinc-500 shrink-0" />

        <div className="flex-1 flex items-center gap-2 min-w-0">
          {selectedAST ? (
            <>
              <span className="text-sm text-gray-900 dark:text-zinc-100 truncate">
                {selectedAST.name}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 shrink-0">
                {CATEGORY_INFO[selectedAST.category].name}
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-400 dark:text-zinc-500">{placeholder}</span>
          )}
        </div>

        {selectedAST && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ')
                handleClear(e as unknown as React.MouseEvent)
            }}
            className="p-0.5 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </span>
        )}

        <ChevronDown
          className={`w-4 h-4 text-gray-400 dark:text-zinc-500 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
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
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500"
              />
            </div>
          </div>

          <div
            className="max-h-[280px] overflow-auto"
            onMouseLeave={() => setHighlightedIndex(-1)}
          >
            {searchResults.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-zinc-500">
                No ASTs found{searchQuery && ` matching "${searchQuery}"`}
              </div>
            ) : groupByCategory && !searchQuery ? (
              renderGroupedResults()
            ) : (
              renderFlatResults()
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface ASTOptionProps {
  ast: ASTConfig
  isHighlighted: boolean
  isSelected: boolean
  onClick: () => void
  onMouseEnter: () => void
}

function ASTOption({ ast, isHighlighted, isSelected, onClick, onMouseEnter }: ASTOptionProps) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`
        flex items-start gap-3 px-3 py-2 cursor-pointer transition-colors
        ${isHighlighted ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'}
        ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''}
      `}
    >
      <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-xs font-bold text-gray-500 dark:text-zinc-500">
          {ast.name.charAt(0).toUpperCase()}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">{ast.name}</span>
          {ast.version && (
            <span className="text-[10px] text-gray-400 dark:text-zinc-600">v{ast.version}</span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">{ast.description}</p>
      </div>

      {isSelected && <Check className="w-4 h-4 text-blue-500 shrink-0 mt-1" />}
    </div>
  )
}
