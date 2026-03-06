import { describe, it, expect } from 'vitest'
import { getAST } from '../registry'
import './register'

describe('login register', () => {
  it('registers login AST', () => {
    const ast = getAST('login')
    expect(ast).toBeDefined()
    expect(ast!.name).toBe('login')
    expect(ast!.label).toBe('Login')
  })
})
