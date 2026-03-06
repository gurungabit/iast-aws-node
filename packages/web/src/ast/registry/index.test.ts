import { describe, it, expect } from 'vitest'
import { registerAST, getAST, getAllASTs } from './index'

// The registry is module-level state, so registrations persist across tests.
// We work around this by using unique ids per test.

describe('AST Registry', () => {
  it('returns undefined for an unknown AST id', () => {
    expect(getAST('nonexistent-ast')).toBeUndefined()
  })

  it('registers an entry and retrieves it with getAST', () => {
    const entry = {
      id: 'test-ast-1',
      name: 'Test AST 1',
      description: 'A test AST',
      category: 'fire' as const,
      component: () => null,
    }

    registerAST(entry)
    const result = getAST('test-ast-1')

    expect(result).toBeDefined()
    expect(result!.id).toBe('test-ast-1')
    expect(result!.name).toBe('Test AST 1')
    expect(result!.description).toBe('A test AST')
    expect(result!.category).toBe('fire')
    expect(result!.component).toBe(entry.component)
    expect(result!.enabled).toBe(true)
    expect(result!.visible).toBe(true)
  })

  it('getAllASTs returns all registered entries', () => {
    registerAST({
      id: 'test-ast-2',
      name: 'Test AST 2',
      description: 'Another test AST',
      category: 'auto',
      component: () => null,
    })

    registerAST({
      id: 'test-ast-3',
      name: 'Test AST 3',
      description: 'Yet another test AST',
      category: 'fire',
      component: () => null,
    })

    const all = getAllASTs()
    const ids = all.map((a) => a.id)

    expect(ids).toContain('test-ast-2')
    expect(ids).toContain('test-ast-3')
  })

  it('overwrites an entry when registering with the same id', () => {
    registerAST({
      id: 'test-ast-overwrite',
      name: 'Original',
      description: 'Original description',
      category: 'auto',
      component: () => null,
    })

    registerAST({
      id: 'test-ast-overwrite',
      name: 'Overwritten',
      description: 'New description',
      category: 'fire',
      component: () => null,
    })

    const result = getAST('test-ast-overwrite')
    expect(result!.name).toBe('Overwritten')
    expect(result!.description).toBe('New description')
    expect(result!.category).toBe('fire')
  })

  it('getAllASTs returns an array', () => {
    const all = getAllASTs()
    expect(Array.isArray(all)).toBe(true)
  })
})
