import { describe, it, expect } from 'vitest'
import { getAST } from '../registry'
import './register'

describe('bi-renew register', () => {
  it('registers bi_renew AST with correct id and name', () => {
    const ast = getAST('bi_renew')
    expect(ast).toBeDefined()
    expect(ast!.id).toBe('bi_renew')
    expect(ast!.name).toBe('BI Renew')
    expect(ast!.category).toBe('auto')
    expect(ast!.component).toBeDefined()
  })
})
