import { describe, it, expect } from 'vitest'
import { registerAST, getAST, getAllASTs } from './index'

// The registry is module-level state, so registrations persist across tests.
// We work around this by using unique names per test.

describe('AST Registry', () => {
  it('returns undefined for an unknown AST name', () => {
    expect(getAST('nonexistent-ast')).toBeUndefined()
  })

  it('registers an entry and retrieves it with getAST', () => {
    const entry = {
      name: 'test-ast-1',
      label: 'Test AST 1',
      description: 'A test AST',
      FormComponent: () => null,
    }

    registerAST(entry)
    const result = getAST('test-ast-1')

    expect(result).toBeDefined()
    expect(result!.name).toBe('test-ast-1')
    expect(result!.label).toBe('Test AST 1')
    expect(result!.description).toBe('A test AST')
    expect(result!.FormComponent).toBe(entry.FormComponent)
  })

  it('getAllASTs returns all registered entries', () => {
    registerAST({
      name: 'test-ast-2',
      label: 'Test AST 2',
      description: 'Another test AST',
      FormComponent: () => null,
    })

    registerAST({
      name: 'test-ast-3',
      label: 'Test AST 3',
      description: 'Yet another test AST',
      FormComponent: () => null,
    })

    const all = getAllASTs()
    const names = all.map((a) => a.name)

    expect(names).toContain('test-ast-2')
    expect(names).toContain('test-ast-3')
  })

  it('overwrites an entry when registering with the same name', () => {
    registerAST({
      name: 'test-ast-overwrite',
      label: 'Original',
      description: 'Original description',
      FormComponent: () => null,
    })

    registerAST({
      name: 'test-ast-overwrite',
      label: 'Overwritten',
      description: 'New description',
      FormComponent: () => null,
    })

    const result = getAST('test-ast-overwrite')
    expect(result!.label).toBe('Overwritten')
    expect(result!.description).toBe('New description')
  })

  it('getAllASTs returns an array', () => {
    const all = getAllASTs()
    expect(Array.isArray(all)).toBe(true)
  })
})
