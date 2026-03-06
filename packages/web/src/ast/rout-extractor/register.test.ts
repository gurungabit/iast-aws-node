import { describe, it, expect } from 'vitest'
import { getAST } from '../registry'
import './register'

describe('rout-extractor register', () => {
  it('registers rout_extractor AST with correct id and name', () => {
    const ast = getAST('rout_extractor')
    expect(ast).toBeDefined()
    expect(ast!.id).toBe('rout_extractor')
    expect(ast!.name).toBe('RoutExtractor')
    expect(ast!.category).toBe('fire')
    expect(ast!.component).toBeDefined()
  })
})
