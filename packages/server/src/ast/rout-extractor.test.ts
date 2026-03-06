import { describe, it, expect, vi } from 'vitest'

const mockRunRoutExtractorAST = vi.hoisted(() => vi.fn())

vi.mock('./rout-extractor/index.js', () => ({
  runRoutExtractorAST: mockRunRoutExtractorAST,
}))

import { runRoutExtractorAST } from './rout-extractor.js'

describe('rout-extractor barrel export', () => {
  it('re-exports runRoutExtractorAST from subdirectory', () => {
    expect(runRoutExtractorAST).toBe(mockRunRoutExtractorAST)
  })

  it('runRoutExtractorAST is a function', () => {
    expect(typeof runRoutExtractorAST).toBe('function')
  })
})
