import { describe, it, expect } from 'vitest'
import { getAST } from '../registry'
import './register'

describe('login register', () => {
  it('registers login AST with correct id and name', () => {
    const ast = getAST('login')
    expect(ast).toBeDefined()
    expect(ast!.id).toBe('login')
    expect(ast!.name).toBe('TSO Login')
    expect(ast!.category).toBe('fire')
    expect(ast!.component).toBeDefined()
  })
})
