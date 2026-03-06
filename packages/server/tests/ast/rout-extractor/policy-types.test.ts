import { describe, it, expect } from 'vitest'
import { getPolicyType, getPolicyTypeFromPdq } from '@src/ast/rout-extractor/policy-types.js'

describe('getPolicyType', () => {
  it('returns exact match for known (sysType, formLine) pair', () => {
    expect(getPolicyType('H', '3')).toBe('HO 3')
    expect(getPolicyType('H', '2')).toBe('HO 2')
    expect(getPolicyType('H', '4')).toBe('HO 4')
    expect(getPolicyType('H', '5')).toBe('HO 5')
    expect(getPolicyType('H', '6')).toBe('HO 6')
    expect(getPolicyType('H', '8')).toBe('HO W')
    expect(getPolicyType('H', '9')).toBe('HO 4')
    expect(getPolicyType('H', 'W')).toBe('HO W')
    expect(getPolicyType('H', 'A')).toBe('HO A')
    expect(getPolicyType('H', 'HO')).toBe('HO')
  })

  it('falls back to empty FormLine entry when exact match not found', () => {
    // H: maps to 'HO'
    expect(getPolicyType('H', 'UNKNOWN')).toBe('HO')
    // A: maps to 'FARM'
    expect(getPolicyType('A', 'UNKNOWN')).toBe('FARM')
    // B: maps to 'BOAT'
    expect(getPolicyType('B', 'UNKNOWN')).toBe('BOAT')
  })

  it('returns empty string for completely unknown system type', () => {
    expect(getPolicyType('X', '0')).toBe('')
    expect(getPolicyType('ZZZ', '1')).toBe('')
  })

  it('handles Farm/Ranch types correctly', () => {
    expect(getPolicyType('A', '')).toBe('FARM')
    expect(getPolicyType('A', '2')).toBe('FARM')
    expect(getPolicyType('A', '3')).toBe('FARM')
    expect(getPolicyType('A', 'FH')).toBe('FARM')
  })

  it('handles Boatowners types correctly', () => {
    expect(getPolicyType('B', '')).toBe('BOAT')
    expect(getPolicyType('B', '0')).toBe('BOAT')
    expect(getPolicyType('B', '1')).toBe('BOAT')
  })

  it('handles PLUP types correctly', () => {
    expect(getPolicyType('L', '')).toBe('PLUP')
    expect(getPolicyType('L', '1')).toBe('PLUP')
    expect(getPolicyType('L', '2')).toBe('PLUP')
    expect(getPolicyType('L', '3')).toBe('PLUP')
    expect(getPolicyType('L', '4')).toBe('PLUP')
  })

  it('handles Monthly payment / Commercial types correctly', () => {
    expect(getPolicyType('M', '00')).toBe('COMP')
    expect(getPolicyType('M', '02')).toBe('COMP')
    expect(getPolicyType('M', '10')).toBe('COML')
    expect(getPolicyType('M', '16')).toBe('INMA')
    expect(getPolicyType('M', '17')).toBe('INMA')
    expect(getPolicyType('M', '60')).toBe('BOND')
    expect(getPolicyType('M', '62')).toBe('LIAB')
    expect(getPolicyType('M', '64')).toBe('COML')
    expect(getPolicyType('M', '68')).toBe('UMBR')
    expect(getPolicyType('M', '74')).toBe('DBL')
  })

  it('handles empty FormLine fallback to M: which is empty string', () => {
    expect(getPolicyType('M', '')).toBe('')
    expect(getPolicyType('M', 'XX')).toBe('')
  })

  it('handles Earthquake types', () => {
    expect(getPolicyType('Q', '5')).toBe('EQ 5')
    expect(getPolicyType('Q', '6')).toBe('EQ 6')
  })

  it('handles CEA types', () => {
    expect(getPolicyType('G', '')).toBe('CEA')
    expect(getPolicyType('G', 'W')).toBe('CEA')
    expect(getPolicyType('G', '3')).toBe('CEA')
  })

  it('trims whitespace from inputs', () => {
    expect(getPolicyType(' H ', ' 3 ')).toBe('HO 3')
    expect(getPolicyType('  A  ', '  2  ')).toBe('FARM')
  })

  it('handles Rental Dwelling types', () => {
    expect(getPolicyType('R', '')).toBe('RD 3')
    expect(getPolicyType('R', '3')).toBe('RD 3')
    expect(getPolicyType('R', 'RD')).toBe('RD 3')
  })

  it('handles Manufactured Home types', () => {
    expect(getPolicyType('T', '')).toBe('MH 3')
    expect(getPolicyType('T', 'MH')).toBe('MH 3')
    expect(getPolicyType('T', '3')).toBe('MH 3')
  })

  it('handles Business Mercantile/Service types', () => {
    expect(getPolicyType('Z', '')).toBe('BUS')
    expect(getPolicyType('Z', '2')).toBe('MERC')
    expect(getPolicyType('Z', '3')).toBe('MERC')
  })

  it('handles no fallback for Q (Earthquake)', () => {
    // Q has no Q: entry, so unknown form lines should return ''
    expect(getPolicyType('Q', 'X')).toBe('')
  })

  it('handles D (Flood) with no fallback entry', () => {
    expect(getPolicyType('D', '0')).toBe('FLD')
    expect(getPolicyType('D', 'X')).toBe('')
  })
})

describe('getPolicyTypeFromPdq', () => {
  it('returns correct type for known PDQ display strings', () => {
    expect(getPolicyTypeFromPdq('APARTMENT')).toBe('APT')
    expect(getPolicyTypeFromPdq('BOATOWNERS')).toBe('BOAT')
    expect(getPolicyTypeFromPdq('CEA')).toBe('CEA')
    expect(getPolicyTypeFromPdq('HOMEOWNERS - 3')).toBe('HO 3')
    expect(getPolicyTypeFromPdq('HOMEOWNERS - 4')).toBe('HO 4')
    expect(getPolicyTypeFromPdq('HOMEOWNER EXTRA')).toBe('HO 5')
    expect(getPolicyTypeFromPdq('PERSNL ARTICLES')).toBe('PAP')
    expect(getPolicyTypeFromPdq('PERS LIAB UMB')).toBe('PLUP')
  })

  it('returns null for unknown PDQ display strings', () => {
    expect(getPolicyTypeFromPdq('UNKNOWN TYPE')).toBeNull()
    expect(getPolicyTypeFromPdq('')).toBeNull()
    expect(getPolicyTypeFromPdq('random')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(getPolicyTypeFromPdq('apartment')).toBe('APT')
    expect(getPolicyTypeFromPdq('Apartment')).toBe('APT')
    expect(getPolicyTypeFromPdq('APARTMENT')).toBe('APT')
    expect(getPolicyTypeFromPdq('boatowners')).toBe('BOAT')
    expect(getPolicyTypeFromPdq('BoAtOwNeRs')).toBe('BOAT')
  })

  it('trims whitespace from input', () => {
    expect(getPolicyTypeFromPdq('  APARTMENT  ')).toBe('APT')
    expect(getPolicyTypeFromPdq(' CEA ')).toBe('CEA')
  })

  it('handles all bond types correctly', () => {
    expect(getPolicyTypeFromPdq('FIDELITY BOND')).toBe('BOND')
    expect(getPolicyTypeFromPdq('SURETY BOND')).toBe('BOND')
  })

  it('handles multiple HO variants', () => {
    expect(getPolicyTypeFromPdq('HOMEOWNER BASIC')).toBe('HO 2')
    expect(getPolicyTypeFromPdq('HOMEOWNERS - 3')).toBe('HO 3')
    expect(getPolicyTypeFromPdq('HOMEOWNERS - 4')).toBe('HO 4')
    expect(getPolicyTypeFromPdq('HO - RENTERS')).toBe('HO 4')
    expect(getPolicyTypeFromPdq('HO 4 COMPANION')).toBe('HO 4')
    expect(getPolicyTypeFromPdq('HOMEOWNER EXTRA')).toBe('HO 5')
    expect(getPolicyTypeFromPdq('COND UNIT OWNRS')).toBe('HO 6')
    expect(getPolicyTypeFromPdq('HO - CONDO UNIT')).toBe('HO 6')
    expect(getPolicyTypeFromPdq('HO-A-LIMITED')).toBe('HO A')
    expect(getPolicyTypeFromPdq('HO - HOMEOWNERS')).toBe('HO W')
    expect(getPolicyTypeFromPdq('HO W COMPANION')).toBe('HO W')
  })

  it('handles liability types', () => {
    expect(getPolicyTypeFromPdq('PERSONAL LIAB')).toBe('LIAB')
    expect(getPolicyTypeFromPdq('FARM LIABILITY')).toBe('LIAB')
    expect(getPolicyTypeFromPdq('RENTAL LIAB')).toBe('LIAB')
  })

  it('handles umbrella types', () => {
    expect(getPolicyTypeFromPdq('COMM UMB LIAB')).toBe('UMBR')
    expect(getPolicyTypeFromPdq('COMM LIAB UMB')).toBe('UMBR')
  })

  it('handles Farm/Ranch variants', () => {
    expect(getPolicyTypeFromPdq('FARM/RANCH')).toBe('FARM')
    expect(getPolicyTypeFromPdq('FARM/RANCH - 3')).toBe('FARM')
    expect(getPolicyTypeFromPdq('FARM/RANCH - 2')).toBe('FARM')
    expect(getPolicyTypeFromPdq('FARM/RANCH - 3T')).toBe('FARM')
  })
})
