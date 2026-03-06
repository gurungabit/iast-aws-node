import { useState, useMemo, useCallback, type ComponentType } from 'react'
import type { ASTConfig, ASTCategory } from './types'

export type { ASTConfig, ASTCategory }
export { CATEGORY_AUTH_GROUP, CATEGORY_INFO } from './types'

const registry = new Map<string, ASTConfig>()

interface RegisterASTInput {
  id: string
  name: string
  description: string
  category: ASTCategory
  keywords?: string[]
  version?: string
  author?: string
  supportsParallel?: boolean
  component: ComponentType
}

export function registerAST(entry: RegisterASTInput) {
  registry.set(entry.id, {
    ...entry,
    keywords: entry.keywords ?? [],
    enabled: true,
    visible: true,
  })
}

export function getAST(id: string): ASTConfig | undefined {
  return registry.get(id)
}

export function getAllASTs(): ASTConfig[] {
  return Array.from(registry.values())
}

export function getVisibleASTs(): ASTConfig[] {
  return Array.from(registry.values()).filter((a) => a.visible && a.enabled)
}

export function getASTsByCategory(category: ASTCategory): ASTConfig[] {
  return Array.from(registry.values()).filter((a) => a.category === category)
}

export function searchASTs(query: string): ASTConfig[] {
  if (!query.trim()) return getVisibleASTs()
  const q = query.toLowerCase().trim()
  return getVisibleASTs()
    .filter(
      (ast) =>
        ast.name.toLowerCase().includes(q) ||
        ast.description.toLowerCase().includes(q) ||
        ast.id.toLowerCase().includes(q) ||
        ast.keywords.some((k) => k.toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      const aExact = a.name.toLowerCase().startsWith(q) ? 0 : 1
      const bExact = b.name.toLowerCase().startsWith(q) ? 0 : 1
      return aExact - bExact
    })
}

export function useASTRegistry() {
  const [searchQuery, setSearchQuery] = useState('')

  const allASTs = useMemo(() => getVisibleASTs(), [])

  const searchResults = useMemo(() => searchASTs(searchQuery), [searchQuery])

  const groupedASTs = useMemo(() => {
    const groups: Record<ASTCategory, ASTConfig[]> = { auto: [], fire: [] }
    for (const ast of allASTs) {
      groups[ast.category].push(ast)
    }
    return groups
  }, [allASTs])

  const getASTById = useCallback((id: string) => getAST(id), [])

  return {
    allASTs,
    searchResults,
    searchQuery,
    setSearchQuery,
    groupedASTs,
    getAST: getASTById,
    getVisibleASTs,
    getASTsByCategory,
    searchASTs,
  }
}
