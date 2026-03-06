import { useState, useRef, useEffect } from 'react'
import { getAllASTs, type ASTRegistryEntry } from '../registry'

interface ASTSelectorProps {
  selected: string | null
  onSelect: (name: string | null) => void
  disabled?: boolean
}

export function ASTSelector({ selected, onSelect, disabled = false }: ASTSelectorProps) {
  const allASTs = getAllASTs()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedAST = selected ? allASTs.find((a) => a.name === selected) : null

  const filteredASTs = searchQuery
    ? allASTs.filter(
        (a) =>
          a.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.description.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : allASTs

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }
  }, [isOpen])

  function handleToggle() {
    if (disabled) return
    if (isOpen) setSearchQuery('')
    setIsOpen(!isOpen)
  }

  function handleSelect(ast: ASTRegistryEntry) {
    onSelect(ast.name)
    setIsOpen(false)
    setSearchQuery('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onSelect(null)
    setSearchQuery('')
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value)
    setHighlightedIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((i) => Math.min(i + 1, filteredASTs.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && filteredASTs[highlightedIndex]) {
          handleSelect(filteredASTs[highlightedIndex])
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
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left cursor-pointer
          ${disabled
            ? 'bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 cursor-not-allowed opacity-60'
            : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-600'
          }
          ${isOpen ? 'border-blue-500 dark:border-blue-500 ring-1 ring-blue-500/20' : ''}
        `}
      >
        {/* Search icon */}
        <svg className="w-4 h-4 text-gray-400 dark:text-zinc-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        {/* Selected value or placeholder */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {selectedAST ? (
            <span className="text-sm text-gray-900 dark:text-zinc-100 truncate">
              {selectedAST.label}
            </span>
          ) : (
            <span className="text-sm text-gray-400 dark:text-zinc-500">Search for an AST...</span>
          )}
        </div>

        {/* Clear button */}
        {selectedAST && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleClear(e as unknown as React.MouseEvent)
            }}
            className="p-0.5 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}

        {/* Dropdown arrow */}
        <svg
          className={`w-4 h-4 text-gray-400 dark:text-zinc-500 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100 dark:border-zinc-800">
            <div className="relative">
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500"
              />
            </div>
          </div>

          {/* Results list */}
          <div
            className="max-h-[280px] overflow-auto"
            onMouseLeave={() => setHighlightedIndex(-1)}
          >
            {filteredASTs.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-zinc-500">
                No ASTs found{searchQuery && ` matching "${searchQuery}"`}
              </div>
            ) : (
              filteredASTs.map((ast, index) => (
                <div
                  key={ast.name}
                  onClick={() => handleSelect(ast)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`
                    flex items-start gap-3 px-3 py-2 cursor-pointer transition-colors
                    ${index === highlightedIndex ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'}
                    ${ast.name === selected ? 'bg-blue-100 dark:bg-blue-900/30' : ''}
                  `}
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-gray-500 dark:text-zinc-500">
                      {ast.label.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                      {ast.label}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">
                      {ast.description}
                    </p>
                  </div>

                  {/* Selected check */}
                  {ast.name === selected && (
                    <svg className="w-4 h-4 text-blue-500 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
