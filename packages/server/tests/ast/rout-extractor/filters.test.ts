import { describe, it, expect } from 'vitest'
import { filterByStatus, filterBySections, filterByUnitExclusions, applyAllFilters } from '@src/ast/rout-extractor/filters.js'
import { createEmptyRouteItem, SECTION_NAMES } from '@src/ast/rout-extractor/models.js'
import type { RouteItem, RoutExtractorConfig } from '@src/ast/rout-extractor/models.js'

function makeItem(overrides: Partial<RouteItem> = {}): RouteItem {
  return { ...createEmptyRouteItem(), ...overrides }
}

function makeConfig(overrides: Partial<RoutExtractorConfig> = {}): RoutExtractorConfig {
  return {
    sourceMode: '412',
    oc: '04',
    sections: [...SECTION_NAMES],
    statusActive: true,
    statusPended: true,
    statusOther: false,
    unitExclusions: [],
    navigationMethod: null,
    navigateAllOccs: true,
    startOcc: 1,
    endOcc: 11,
    supvIds: [],
    updateRouteItems: false,
    file412Path: '',
    missing412Strategy: 'stop',
    ...overrides,
  }
}

describe('filterByStatus', () => {
  const activeItem = makeItem({ status: 'A' })
  const pendedItem = makeItem({ status: 'P' })
  const otherItem = makeItem({ status: 'X' })
  const items = [activeItem, pendedItem, otherItem]

  it('keeps only active items when statusActive is true and statusPended is false', () => {
    const cfg = makeConfig({ statusActive: true, statusPended: false })
    const result = filterByStatus(items, cfg)
    expect(result).toEqual([activeItem])
  })

  it('keeps only pended items when statusPended is true and statusActive is false', () => {
    const cfg = makeConfig({ statusActive: false, statusPended: true })
    const result = filterByStatus(items, cfg)
    expect(result).toEqual([pendedItem])
  })

  it('keeps both active and pended items when both are true', () => {
    const cfg = makeConfig({ statusActive: true, statusPended: true })
    const result = filterByStatus(items, cfg)
    expect(result).toEqual([activeItem, pendedItem])
  })

  it('returns all items when statusOther is true (bypass)', () => {
    const cfg = makeConfig({ statusOther: true, statusActive: false, statusPended: false })
    const result = filterByStatus(items, cfg)
    expect(result).toEqual(items)
  })

  it('returns empty array when no status flags are set', () => {
    const cfg = makeConfig({ statusActive: false, statusPended: false, statusOther: false })
    const result = filterByStatus(items, cfg)
    expect(result).toEqual([])
  })

  it('handles empty items array', () => {
    const cfg = makeConfig({ statusActive: true })
    const result = filterByStatus([], cfg)
    expect(result).toEqual([])
  })

  it('handles status with whitespace and case insensitivity (trims and uppercases)', () => {
    const itemWithSpace = makeItem({ status: ' a ' })
    const cfg = makeConfig({ statusActive: true, statusPended: false })
    const result = filterByStatus([itemWithSpace], cfg)
    expect(result).toEqual([itemWithSpace])
  })

  it('handles lowercase status values', () => {
    const lowerActive = makeItem({ status: 'a' })
    const lowerPended = makeItem({ status: 'p' })
    const cfg = makeConfig({ statusActive: true, statusPended: true })
    const result = filterByStatus([lowerActive, lowerPended], cfg)
    expect(result).toEqual([lowerActive, lowerPended])
  })
})

describe('filterBySections', () => {
  it('returns all items when all sections are selected', () => {
    const items = [
      makeItem({ sectionOfRout: 'ROUTED ITEMS', policyItem: '' }),
      makeItem({ sectionOfRout: 'ERROR MEMOS', policyItem: 'ERROR' }),
    ]
    const cfg = makeConfig({ sections: [...SECTION_NAMES] })
    const result = filterBySections(items, cfg)
    expect(result).toEqual(items)
  })

  it('returns empty array when sections is empty', () => {
    const items = [makeItem({ sectionOfRout: 'ROUTED ITEMS' })]
    const cfg = makeConfig({ sections: [] })
    const result = filterBySections(items, cfg)
    expect(result).toEqual([])
  })

  it('filters to only ROUTED ITEMS section', () => {
    const routedItem = makeItem({ sectionOfRout: 'ROUTED ITEMS', policyItem: '' })
    const errorItem = makeItem({ sectionOfRout: 'ERROR MEMOS', policyItem: 'ERROR' })
    const cfg = makeConfig({ sections: ['ROUTED ITEMS'] })
    const result = filterBySections([routedItem, errorItem], cfg)
    expect(result).toEqual([routedItem])
  })

  it('includes items matching specific section policyItem values', () => {
    const errorItem = makeItem({ sectionOfRout: 'OTHER', policyItem: 'ERROR' })
    const gfuItem = makeItem({ sectionOfRout: 'OTHER', policyItem: 'GFU' })
    const unmatchedItem = makeItem({ sectionOfRout: 'OTHER', policyItem: 'UNKNOWN' })

    const cfg = makeConfig({ sections: ['ERROR MEMOS', 'GENERAL FOLLOW UP MEMOS'] })
    const result = filterBySections([errorItem, gfuItem, unmatchedItem], cfg)
    expect(result).toEqual([errorItem, gfuItem])
  })

  it('includes ROUTED ITEMS when selected alongside other sections', () => {
    const routedItem = makeItem({ sectionOfRout: 'ROUTED ITEMS', policyItem: '' })
    const errorItem = makeItem({ sectionOfRout: 'OTHER', policyItem: 'ERROR' })

    const cfg = makeConfig({ sections: ['ROUTED ITEMS', 'ERROR MEMOS'] })
    const result = filterBySections([routedItem, errorItem], cfg)
    expect(result).toEqual([routedItem, errorItem])
  })

  it('excludes ROUTED ITEMS when not selected', () => {
    const routedItem = makeItem({ sectionOfRout: 'ROUTED ITEMS', policyItem: '' })
    const errorItem = makeItem({ sectionOfRout: 'OTHER', policyItem: 'ERROR' })

    const cfg = makeConfig({ sections: ['ERROR MEMOS'] })
    const result = filterBySections([routedItem, errorItem], cfg)
    expect(result).toEqual([errorItem])
  })

  it('handles empty items array', () => {
    const cfg = makeConfig({ sections: ['ROUTED ITEMS'] })
    const result = filterBySections([], cfg)
    expect(result).toEqual([])
  })

  it('maps ECHO POLICY TRANSACTIONS to ECHOPT policyItem', () => {
    const echoItem = makeItem({ sectionOfRout: 'OTHER', policyItem: 'ECHOPT' })
    const cfg = makeConfig({ sections: ['ECHO POLICY TRANSACTIONS'] })
    const result = filterBySections([echoItem], cfg)
    expect(result).toEqual([echoItem])
  })

  it('maps INTERNET POLICY TRANSACTIONS to INTERNETPT policyItem', () => {
    const item = makeItem({ sectionOfRout: 'OTHER', policyItem: 'INTERNETPT' })
    const cfg = makeConfig({ sections: ['INTERNET POLICY TRANSACTIONS'] })
    const result = filterBySections([item], cfg)
    expect(result).toEqual([item])
  })

  it('maps MONTHLY PAYMENT POLICY TRANSACTIONS to MPPPT policyItem', () => {
    const item = makeItem({ sectionOfRout: 'OTHER', policyItem: 'MPPPT' })
    const cfg = makeConfig({ sections: ['MONTHLY PAYMENT POLICY TRANSACTIONS'] })
    const result = filterBySections([item], cfg)
    expect(result).toEqual([item])
  })

  it('maps MOTOR VEHICLE REPORTS to MVR policyItem', () => {
    const item = makeItem({ sectionOfRout: 'OTHER', policyItem: 'MVR' })
    const cfg = makeConfig({ sections: ['MOTOR VEHICLE REPORTS'] })
    const result = filterBySections([item], cfg)
    expect(result).toEqual([item])
  })

  it('maps PLUP ACTIVITY MESSAGES to PLUA policyItem', () => {
    const item = makeItem({ sectionOfRout: 'OTHER', policyItem: 'PLUA' })
    const cfg = makeConfig({ sections: ['PLUP ACTIVITY MESSAGES'] })
    const result = filterBySections([item], cfg)
    expect(result).toEqual([item])
  })

  it('maps QUOTE RESULTS to QUOTE policyItem', () => {
    const item = makeItem({ sectionOfRout: 'OTHER', policyItem: 'QUOTE' })
    const cfg = makeConfig({ sections: ['QUOTE RESULTS'] })
    const result = filterBySections([item], cfg)
    expect(result).toEqual([item])
  })

  it('maps STATE TO STATE TRANSFERS to STS policyItem', () => {
    const item = makeItem({ sectionOfRout: 'OTHER', policyItem: 'STS' })
    const cfg = makeConfig({ sections: ['STATE TO STATE TRANSFERS'] })
    const result = filterBySections([item], cfg)
    expect(result).toEqual([item])
  })

  it('trims sectionOfRout and policyItem when matching', () => {
    const item = makeItem({ sectionOfRout: '  ROUTED ITEMS  ', policyItem: '' })
    const cfg = makeConfig({ sections: ['ROUTED ITEMS'] })
    const result = filterBySections([item], cfg)
    expect(result).toEqual([item])
  })
})

describe('filterByUnitExclusions', () => {
  it('returns all items when no exclusions configured', () => {
    const items = [makeItem({ pui: 'PUI1' }), makeItem({ pui: 'PUI2' })]
    const cfg = makeConfig({ unitExclusions: [] })
    const result = filterByUnitExclusions(items, cfg)
    expect(result).toEqual(items)
  })

  it('excludes items with matching PUI', () => {
    const items = [
      makeItem({ pui: 'PUI1' }),
      makeItem({ pui: 'PUI2' }),
      makeItem({ pui: 'PUI3' }),
    ]
    const cfg = makeConfig({ unitExclusions: ['PUI2'] })
    const result = filterByUnitExclusions(items, cfg)
    expect(result).toEqual([items[0], items[2]])
  })

  it('handles case-insensitive PUI matching', () => {
    const items = [makeItem({ pui: 'pui1' }), makeItem({ pui: 'PUI2' })]
    const cfg = makeConfig({ unitExclusions: ['PUI1'] })
    const result = filterByUnitExclusions(items, cfg)
    expect(result).toEqual([items[1]])
  })

  it('trims whitespace from PUI and exclusion values', () => {
    const items = [makeItem({ pui: ' PUI1 ' })]
    const cfg = makeConfig({ unitExclusions: [' PUI1 '] })
    const result = filterByUnitExclusions(items, cfg)
    expect(result).toEqual([])
  })

  it('handles multiple exclusions', () => {
    const items = [
      makeItem({ pui: 'A' }),
      makeItem({ pui: 'B' }),
      makeItem({ pui: 'C' }),
      makeItem({ pui: 'D' }),
    ]
    const cfg = makeConfig({ unitExclusions: ['A', 'C'] })
    const result = filterByUnitExclusions(items, cfg)
    expect(result).toEqual([items[1], items[3]])
  })

  it('returns all items when exclusions contain only empty/whitespace strings', () => {
    const items = [makeItem({ pui: 'PUI1' })]
    const cfg = makeConfig({ unitExclusions: ['', '  '] })
    const result = filterByUnitExclusions(items, cfg)
    expect(result).toEqual(items)
  })

  it('handles empty items array', () => {
    const cfg = makeConfig({ unitExclusions: ['PUI1'] })
    const result = filterByUnitExclusions([], cfg)
    expect(result).toEqual([])
  })
})

describe('applyAllFilters', () => {
  it('applies all three filters in sequence', () => {
    const items = [
      makeItem({ status: 'A', sectionOfRout: 'ROUTED ITEMS', pui: 'PUI1' }),
      makeItem({ status: 'P', sectionOfRout: 'ROUTED ITEMS', pui: 'PUI2' }),
      makeItem({ status: 'X', sectionOfRout: 'ROUTED ITEMS', pui: 'PUI3' }),
      makeItem({ status: 'A', sectionOfRout: 'OTHER', policyItem: 'ERROR', pui: 'PUI4' }),
      makeItem({ status: 'A', sectionOfRout: 'ROUTED ITEMS', pui: 'EXCLUDED' }),
    ]

    const cfg = makeConfig({
      statusActive: true,
      statusPended: false,
      statusOther: false,
      sections: ['ROUTED ITEMS', 'ERROR MEMOS'],
      unitExclusions: ['EXCLUDED'],
    })

    const result = applyAllFilters(items, cfg)

    // item[0]: status=A (pass), section=ROUTED ITEMS (pass), pui=PUI1 (pass) -> included
    // item[1]: status=P (fail) -> excluded
    // item[2]: status=X (fail) -> excluded
    // item[3]: status=A (pass), section=OTHER/ERROR (pass), pui=PUI4 (pass) -> included
    // item[4]: status=A (pass), section=ROUTED ITEMS (pass), pui=EXCLUDED (fail) -> excluded
    expect(result).toEqual([items[0], items[3]])
  })

  it('returns empty when status filter eliminates all items', () => {
    const items = [makeItem({ status: 'X', sectionOfRout: 'ROUTED ITEMS' })]
    const cfg = makeConfig({ statusActive: true, statusPended: true, statusOther: false })
    const result = applyAllFilters(items, cfg)
    expect(result).toEqual([])
  })

  it('returns empty when section filter eliminates all items', () => {
    const items = [makeItem({ status: 'A', sectionOfRout: 'ROUTED ITEMS' })]
    const cfg = makeConfig({ sections: ['ERROR MEMOS'] })
    const result = applyAllFilters(items, cfg)
    expect(result).toEqual([])
  })

  it('returns empty when unit exclusion filter eliminates all items', () => {
    const items = [makeItem({ status: 'A', sectionOfRout: 'ROUTED ITEMS', pui: 'EXCLUDED' })]
    const cfg = makeConfig({ sections: ['ROUTED ITEMS'], unitExclusions: ['EXCLUDED'] })
    const result = applyAllFilters(items, cfg)
    expect(result).toEqual([])
  })

  it('handles empty items array', () => {
    const cfg = makeConfig()
    const result = applyAllFilters([], cfg)
    expect(result).toEqual([])
  })

  it('passes all items through when all filters are permissive', () => {
    const items = [
      makeItem({ status: 'A', sectionOfRout: 'ROUTED ITEMS', pui: 'PUI1' }),
      makeItem({ status: 'P', sectionOfRout: 'OTHER', policyItem: 'ERROR', pui: 'PUI2' }),
    ]
    const cfg = makeConfig({
      statusActive: true,
      statusPended: true,
      statusOther: false,
      sections: [...SECTION_NAMES],
      unitExclusions: [],
    })
    const result = applyAllFilters(items, cfg)
    expect(result).toEqual(items)
  })
})
