import { describe, it, expect } from 'vitest'
import { getAST } from '../registry'
import './register'

describe('bi-renew register', () => {
  it('registers bi-renew AST', () => {
    const ast = getAST('bi-renew')
    expect(ast).toBeDefined()
    expect(ast!.name).toBe('bi-renew')
    expect(ast!.label).toBe('BI Renew')
  })
})
