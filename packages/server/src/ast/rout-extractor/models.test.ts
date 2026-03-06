import { describe, it, expect } from 'vitest'
import { createEmptyRouteItem, buildConfig, SECTION_NAMES } from './models.js'

describe('createEmptyRouteItem', () => {
  it('returns an object with all string fields set to empty strings', () => {
    const item = createEmptyRouteItem()
    const stringFields = Object.entries(item).filter(([, v]) => typeof v === 'string')
    for (const [, value] of stringFields) {
      expect(value).toBe('')
    }
    // Spot-check some specific fields
    expect(item.policyNumber).toBe('')
    expect(item.pui).toBe('')
    expect(item.status).toBe('')
    expect(item.policyType).toBe('')
  })

  it('returns noOfErrors as 0', () => {
    const item = createEmptyRouteItem()
    expect(item.noOfErrors).toBe(0)
  })

  it('returns needsPdqEnrichment as false', () => {
    const item = createEmptyRouteItem()
    expect(item.needsPdqEnrichment).toBe(false)
  })

  it('returns a new object each time (not shared reference)', () => {
    const a = createEmptyRouteItem()
    const b = createEmptyRouteItem()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  it('has all expected keys', () => {
    const item = createEmptyRouteItem()
    const expectedKeys = [
      'policyNumber', 'policyNumberFmt', 'pui', 'companyCode',
      'highOrder', 'termDigits', 'checkDigit', 'policyItem',
      'policyType', 'gfuCode', 'team', 'agentNafo', 'agent',
      'afo', 'gfuDate', 'sectionOfRout', 'description',
      'whosQueue', 'specificQueue', 'servOrUndr', 'queueName',
      'noOfErrors', 'errorCode1', 'errorCode2', 'errorCode3',
      'errorCode4', 'errorCode5', 'errorCode6', 'errorCode7',
      'errorCode8', 'streamed', 'images', 'status', 'queueDetail',
      'remarks', 'uniqueRoutId', 'stateCode', 'annivDate',
      'flmpCode', 'audit', 'county', 'clntId', 'textMessage1',
      'routFromUser1', 'routActionDate1', 'systemPolicyType',
      'systemFormLine', 'queueNum', 'occurNum', 'oldPolicyNumber',
      'timeQuoted', 'cancelEffDate', 'statusCode', 'officeNum',
      'dateOfRun', 'alias', 'needsPdqEnrichment',
    ]
    for (const key of expectedKeys) {
      expect(item).toHaveProperty(key)
    }
  })
})

describe('SECTION_NAMES', () => {
  it('is an array of 10 section names', () => {
    expect(SECTION_NAMES).toHaveLength(10)
  })

  it('contains ROUTED ITEMS as first entry', () => {
    expect(SECTION_NAMES[0]).toBe('ROUTED ITEMS')
  })

  it('contains known section names', () => {
    expect(SECTION_NAMES).toContain('ECHO POLICY TRANSACTIONS')
    expect(SECTION_NAMES).toContain('ERROR MEMOS')
    expect(SECTION_NAMES).toContain('GENERAL FOLLOW UP MEMOS')
    expect(SECTION_NAMES).toContain('MOTOR VEHICLE REPORTS')
    expect(SECTION_NAMES).toContain('QUOTE RESULTS')
  })
})

describe('buildConfig', () => {
  it('returns all defaults when given empty params', () => {
    const cfg = buildConfig({})
    expect(cfg.sourceMode).toBe('412')
    expect(cfg.oc).toBe('04')
    expect(cfg.sections).toEqual(SECTION_NAMES)
    expect(cfg.statusActive).toBe(true)
    expect(cfg.statusPended).toBe(true)
    expect(cfg.statusOther).toBe(false)
    expect(cfg.unitExclusions).toEqual([])
    expect(cfg.navigationMethod).toBeNull()
    expect(cfg.navigateAllOccs).toBe(true)
    expect(cfg.startOcc).toBe(1)
    expect(cfg.endOcc).toBe(11)
    expect(cfg.supvIds).toEqual([])
    expect(cfg.updateRouteItems).toBe(false)
    expect(cfg.file412Path).toBe('')
    expect(cfg.missing412Strategy).toBe('stop')
  })

  it('uses provided sourceMode', () => {
    const cfg = buildConfig({ sourceMode: 'rout' })
    expect(cfg.sourceMode).toBe('rout')
  })

  it('uses provided oc', () => {
    const cfg = buildConfig({ oc: '07' })
    expect(cfg.oc).toBe('07')
  })

  it('uses provided sections when array', () => {
    const sections = ['ROUTED ITEMS', 'ERROR MEMOS']
    const cfg = buildConfig({ sections })
    expect(cfg.sections).toEqual(sections)
  })

  it('filters non-string values from sections array', () => {
    const cfg = buildConfig({ sections: ['ROUTED ITEMS', 42, null, 'ERROR MEMOS'] })
    expect(cfg.sections).toEqual(['ROUTED ITEMS', 'ERROR MEMOS'])
  })

  it('defaults sections to SECTION_NAMES when sections is not an array', () => {
    const cfg = buildConfig({ sections: 'not-an-array' })
    expect(cfg.sections).toEqual(SECTION_NAMES)
  })

  it('defaults sections to SECTION_NAMES when sections is undefined', () => {
    const cfg = buildConfig({})
    expect(cfg.sections).toEqual(SECTION_NAMES)
  })

  it('parses unitExclusions from semicolon-separated string', () => {
    const cfg = buildConfig({ unitExclusions: 'PUI1;PUI2;PUI3' })
    expect(cfg.unitExclusions).toEqual(['PUI1', 'PUI2', 'PUI3'])
  })

  it('trims and filters empty entries from unitExclusions string', () => {
    const cfg = buildConfig({ unitExclusions: ' PUI1 ; ; PUI2 ;' })
    expect(cfg.unitExclusions).toEqual(['PUI1', 'PUI2'])
  })

  it('uses unitExclusions array directly', () => {
    const cfg = buildConfig({ unitExclusions: ['A', 'B'] })
    expect(cfg.unitExclusions).toEqual(['A', 'B'])
  })

  it('defaults unitExclusions to empty array when not provided', () => {
    const cfg = buildConfig({})
    expect(cfg.unitExclusions).toEqual([])
  })

  it('defaults unitExclusions to empty array for non-string/non-array values', () => {
    const cfg = buildConfig({ unitExclusions: 123 })
    expect(cfg.unitExclusions).toEqual([])
  })

  it('parses supvIds from semicolon-separated string', () => {
    const cfg = buildConfig({ supvIds: 'ID1;ID2;ID3' })
    expect(cfg.supvIds).toEqual(['ID1', 'ID2', 'ID3'])
  })

  it('trims and filters empty entries from supvIds string', () => {
    const cfg = buildConfig({ supvIds: ' ID1 ; ; ID2 ;' })
    expect(cfg.supvIds).toEqual(['ID1', 'ID2'])
  })

  it('uses supvIds array directly', () => {
    const cfg = buildConfig({ supvIds: ['X', 'Y'] })
    expect(cfg.supvIds).toEqual(['X', 'Y'])
  })

  it('defaults supvIds to empty array when not provided', () => {
    const cfg = buildConfig({})
    expect(cfg.supvIds).toEqual([])
  })

  it('defaults supvIds to empty array for non-string/non-array values', () => {
    const cfg = buildConfig({ supvIds: 999 })
    expect(cfg.supvIds).toEqual([])
  })

  it('uses provided boolean values', () => {
    const cfg = buildConfig({
      statusActive: false,
      statusPended: false,
      statusOther: true,
      navigateAllOccs: false,
      updateRouteItems: true,
    })
    expect(cfg.statusActive).toBe(false)
    expect(cfg.statusPended).toBe(false)
    expect(cfg.statusOther).toBe(true)
    expect(cfg.navigateAllOccs).toBe(false)
    expect(cfg.updateRouteItems).toBe(true)
  })

  it('uses provided numeric values', () => {
    const cfg = buildConfig({ startOcc: 5, endOcc: 20 })
    expect(cfg.startOcc).toBe(5)
    expect(cfg.endOcc).toBe(20)
  })

  it('uses provided navigationMethod', () => {
    const cfg = buildConfig({ navigationMethod: 'supv' })
    expect(cfg.navigationMethod).toBe('supv')

    const cfg2 = buildConfig({ navigationMethod: 'occ' })
    expect(cfg2.navigationMethod).toBe('occ')
  })

  it('uses provided file412Path', () => {
    const cfg = buildConfig({ file412Path: '/some/path.csv' })
    expect(cfg.file412Path).toBe('/some/path.csv')
  })

  it('uses provided missing412Strategy', () => {
    const cfg = buildConfig({ missing412Strategy: 'use_rout' })
    expect(cfg.missing412Strategy).toBe('use_rout')

    const cfg2 = buildConfig({ missing412Strategy: 'wait' })
    expect(cfg2.missing412Strategy).toBe('wait')
  })
})
