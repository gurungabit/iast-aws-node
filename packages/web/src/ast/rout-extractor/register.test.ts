import { describe, it, expect } from 'vitest'
import { getAST } from '../registry'
import './register'

describe('rout-extractor register', () => {
  it('registers rout-extractor AST', () => {
    const ast = getAST('rout-extractor')
    expect(ast).toBeDefined()
    expect(ast!.name).toBe('rout-extractor')
    expect(ast!.label).toBe('Route Extractor')
  })
})
