import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@src/ast/rout-extractor/policy-types.js', () => ({
  getPolicyType: vi.fn().mockReturnValue('HO 3'),
}))

import { parse412File, resolve412Path } from '@src/ast/rout-extractor/file-412.js'

/**
 * Helper to build a fixed-width 412 line with specific fields set.
 * The 412 file format is 1523 characters wide with fields at defined column positions.
 */
function build412Line(overrides: Record<string, { start: number; value: string }> = {}): string {
  const line = new Array(1524).fill(' ')

  // Set defaults so the line is parseable
  const defaults: Record<string, { start: number; value: string }> = {
    office_num: { start: 1, value: '04' },
    division: { start: 3, value: '1' },
    numeric_company_code: { start: 4, value: '2' },
    pui: { start: 5, value: 'AB' },
    alpha_company_code: { start: 7, value: 'C' },
    high_order: { start: 8, value: '12' },
    term_digits: { start: 10, value: '3456' },
    check_digit: { start: 14, value: '7' },
    agent: { start: 22, value: '1234' },
    afo: { start: 29, value: 'AF01' },
    received_date: { start: 59, value: '20240315' },
    queue_name: { start: 68, value: 'OPERATOR       ' },
    queue_detail: { start: 84, value: 'A              ' },
    policy_item: { start: 322, value: 'ERROR     ' },
    system_policy_type: { start: 333, value: 'H ' },
    system_form_line: { start: 336, value: '3 ' },
    status: { start: 318, value: 'A' },
    serv_or_undr: { start: 320, value: 'S' },
    description: { start: 691, value: 'Test Description              ' },
    company_code: { start: 1212, value: 'C' },
  }

  for (const [, spec] of Object.entries({ ...defaults, ...overrides })) {
    for (let i = 0; i < spec.value.length; i++) {
      line[spec.start - 1 + i] = spec.value[i]
    }
  }

  return line.join('')
}

describe('parse412File', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses a single valid 412 line', () => {
    const line = build412Line()
    const items = parse412File(line, '03/15/24')

    expect(items).toHaveLength(1)
    const item = items[0]
    expect(item.pui).toBe('AB')
    expect(item.highOrder).toBe('12')
    expect(item.termDigits).toBe('3456')
    expect(item.checkDigit).toBe('7')
    expect(item.policyNumber).toBe('AB-12-3456-7')
    expect(item.policyNumberFmt).toBe('123456AB')
    expect(item.dateOfRun).toBe('03/15/24')
  })

  it('skips empty lines', () => {
    const content = '\n\n' + build412Line() + '\n\n'
    const items = parse412File(content, '03/15/24')
    expect(items).toHaveLength(1)
  })

  it('skips lines shorter than 322 characters', () => {
    const shortLine = 'This is a short line'
    const content = shortLine + '\n' + build412Line()
    const items = parse412File(content, '03/15/24')
    expect(items).toHaveLength(1)
  })

  it('parses multiple lines', () => {
    const content = build412Line() + '\n' + build412Line({
      pui: { start: 5, value: 'XY' },
    })
    const items = parse412File(content, '03/15/24')
    expect(items).toHaveLength(2)
    expect(items[0].pui).toBe('AB')
    expect(items[1].pui).toBe('XY')
  })

  it('returns empty array for empty input', () => {
    const items = parse412File('', '03/15/24')
    expect(items).toHaveLength(0)
  })

  it('formats GFU date from received_date', () => {
    const line = build412Line({
      received_date: { start: 59, value: '20240315' },
    })
    const items = parse412File(line, '03/15/24')
    // formatGfuDate: MM/DD/YY from YYYYMMDD = 03/15/24
    expect(items[0].gfuDate).toBe('03/15/24')
  })

  it('counts error codes', () => {
    const line = build412Line({
      error_code1: { start: 959, value: 'ERR0001    ' },
      error_code2: { start: 971, value: 'ERR0002    ' },
      error_code3: { start: 983, value: '           ' },
    })
    const items = parse412File(line, '03/15/24')
    expect(items[0].noOfErrors).toBe(2)
  })

  it('derives section from policy_item', () => {
    const line = build412Line({
      policy_item: { start: 322, value: 'ERROR     ' },
      queue_name: { start: 68, value: 'SOMEQUEUE      ' },
    })
    const items = parse412File(line, '03/15/24')
    expect(items[0].sectionOfRout).toBe('ERROR MEMOS')
  })

  it('derives ROUTED ITEMS section when queue is OPERATOR with routed action', () => {
    const line = build412Line({
      queue_name: { start: 68, value: 'OPERATOR       ' },
      rout_action1: { start: 362, value: 'ROUTED' },
    })
    const items = parse412File(line, '03/15/24')
    expect(items[0].sectionOfRout).toBe('ROUTED ITEMS')
  })

  it('handles images field - asterisk maps to Y', () => {
    const line = build412Line({
      images: { start: 309, value: '*' },
    })
    const items = parse412File(line, '03/15/24')
    expect(items[0].images).toBe('Y')
  })

  it('handles images field - non-asterisk maps to N', () => {
    const line = build412Line({
      images: { start: 309, value: ' ' },
    })
    const items = parse412File(line, '03/15/24')
    expect(items[0].images).toBe('N')
  })

  it('computes agentNafo correctly', () => {
    const line = build412Line({
      agent: { start: 22, value: '1234' },
      afo: { start: 29, value: 'AF01' },
    })
    const items = parse412File(line, '03/15/24')
    // afo.length >= 4 -> agent/afo.slice(2,4) = "1234/01"
    expect(items[0].agentNafo).toBe('1234/01')
  })

  it('marks needsPdqEnrichment when policyType is empty', async () => {
    const { getPolicyType } = await import('@src/ast/rout-extractor/policy-types.js')
    vi.mocked(getPolicyType).mockReturnValueOnce('')

    const line = build412Line()
    const items = parse412File(line, '03/15/24')
    expect(items[0].needsPdqEnrichment).toBe(true)
  })
})

describe('resolve412Path', () => {
  it('returns custom path when provided', () => {
    const result = resolve412Path('04', '/custom/path.txt')
    expect(result).toBe('/custom/path.txt')
  })

  it('returns Canada path for OC 03', () => {
    const result = resolve412Path('03')
    expect(result).toContain('CANADA')
    expect(result).toContain('R03.fire.rw412.txt')
  })

  it('returns default path for other OCs', () => {
    const result = resolve412Path('04')
    expect(result).toContain('CORP')
    expect(result).toContain('R04.fire.rw412.txt')
  })
})
