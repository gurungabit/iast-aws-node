import { describe, it, expect, vi } from 'vitest'
import { Tnz } from 'tnz3270-node'

vi.mock('tnz3270-node', () => ({
  Tnz: class {},
}))

/** Subset of Tnz properties used by renderAnsiScreen */
interface MockTnz {
  maxCol: number
  maxRow: number
  bufferSize: number
  curadd: number
  pwait: boolean
  systemLockWait: boolean
  planeFa: Uint8Array
  planeFg: Uint8Array
  planeEh: Uint8Array
  planeDc: Uint8Array
  scrstr: ReturnType<typeof vi.fn>
  fields: ReturnType<typeof vi.fn>
  nextField: ReturnType<typeof vi.fn>
  _field: ReturnType<typeof vi.fn>
}

function createMockTnz(overrides: Partial<MockTnz> = {}): Tnz {
  return Object.assign(new Tnz(), { ...createDefaultMockTnz(), ...overrides })
}

function createDefaultMockTnz(): MockTnz {
  const maxCol = 80
  const maxRow = 24
  const bufferSize = maxCol * maxRow
  const text = ' '.repeat(bufferSize)

  return {
    maxCol,
    maxRow,
    bufferSize,
    curadd: 0,
    pwait: false,
    systemLockWait: false,
    planeFa: new Uint8Array(bufferSize),
    planeFg: new Uint8Array(bufferSize),
    planeEh: new Uint8Array(bufferSize),
    planeDc: new Uint8Array(bufferSize),
    scrstr: vi.fn((_r: number, _c: number, _b: boolean) => text),
    fields: vi.fn(function* () {} as () => Generator<[number, number]>),
    nextField: vi.fn((_pos: number) => [-1] as [number]),
    _field: vi.fn((_i: number) => [0, 0x20] as [number, number]),
  }
}

// Import the function under test AFTER mocks (no module-level mocks needed here -- pure function)
import { renderAnsiScreen } from './renderer.js'

describe('renderAnsiScreen', () => {
  it('should start with cursor-home escape sequence', () => {
    const tnz = createMockTnz()
    const result = renderAnsiScreen(tnz)
    expect(result.startsWith('\x1B[H')).toBe(true)
  })

  it('should end with reset escape and cursor positioning', () => {
    const tnz = createMockTnz({ curadd: 0 })
    const result = renderAnsiScreen(tnz)
    // Should end with reset + cursor position (row 1, col 1 for curadd=0)
    expect(result).toContain('\x1B[0m')
    expect(result.endsWith('\x1B[1;1H')).toBe(true)
  })

  it('should position cursor correctly based on curadd', () => {
    // curadd = 163 => row = floor(163/80)+1 = 3, col = (163%80)+1 = 4
    const tnz = createMockTnz({ curadd: 163 })
    const result = renderAnsiScreen(tnz)
    expect(result.endsWith('\x1B[3;4H')).toBe(true)
  })

  it('should insert newlines at row boundaries', () => {
    const tnz = createMockTnz()
    const result = renderAnsiScreen(tnz)
    // After each row of 80 chars, there should be a reset + CRLF
    const lines = result.split('\r\n')
    // 24 rows means 23 line breaks = 24 segments
    expect(lines.length).toBe(24)
  })

  it('should render hidden fields as asterisks when planeDc has non-null data', () => {
    const bufferSize = 80 * 24
    const text = 'A'.repeat(bufferSize)
    const planeDc = new Uint8Array(bufferSize)
    // Mark position 5 as hidden field attribute 0x0c, with DC data
    planeDc[5] = 0xc1 // non-zero, non-0x40

    const tnz = createMockTnz({
      scrstr: vi.fn(() => text),
      planeDc,
      _field: vi.fn((_i: number) => {
        if (_i === 5) return [4, 0x0c] as [number, number]
        return [0, 0x0c] as [number, number]
      }),
    })

    const result = renderAnsiScreen(tnz)
    // Position 5 should be rendered as '*' since it's hidden + has DC data
    // We need to parse the output to check the character at position 5
    // The format is \x1B[0;...m<char> per character
    // Let's check the output contains '*'
    expect(result).toContain('*')
  })

  it('should render hidden fields as spaces when planeDc is 0 or 0x40', () => {
    const bufferSize = 80 * 24
    const text = 'A'.repeat(bufferSize)
    const planeDc = new Uint8Array(bufferSize)
    planeDc[5] = 0x00 // zero
    planeDc[6] = 0x40 // 0x40

    const tnz = createMockTnz({
      scrstr: vi.fn(() => text),
      planeDc,
      _field: vi.fn(() => [0, 0x0c] as [number, number]),
    })

    const result = renderAnsiScreen(tnz)
    // All chars should be spaces since field is hidden and DC is 0 or 0x40
    expect(result).not.toContain('*')
  })

  it('should render field attribute positions as spaces', () => {
    const bufferSize = 80 * 24
    const text = 'X'.repeat(bufferSize)
    const planeFa = new Uint8Array(bufferSize)
    planeFa[10] = 1 // position 10 is a field attribute

    const tnz = createMockTnz({
      scrstr: vi.fn(() => text),
      planeFa,
      _field: vi.fn(() => [0, 0x20] as [number, number]),
    })

    const result = renderAnsiScreen(tnz)
    // The character at FA positions should be ' ' not 'X'
    // We need to verify position 10 renders as space
    // Extract the segment for the first row
    const firstRow = result.split('\r\n')[0]
    // Position 10 should have a space character
    // Each char is preceded by an escape code like \x1B[0;94m
    // eslint-disable-next-line no-control-regex
    const chars = firstRow.replace(/\x1B\[[^m]*m/g, '')
    // Remove the leading \x1B[H
    const cleaned = chars.replace('\x1B[H', '')
    expect(cleaned[10]).toBe(' ')
  })

  it('should apply color from planeFg using colorMap', () => {
    const bufferSize = 80 * 24
    const text = 'A'.repeat(bufferSize)
    const planeFg = new Uint8Array(bufferSize)
    planeFg[0] = 0xf1 // blue (34)

    const tnz = createMockTnz({
      scrstr: vi.fn(() => text),
      planeFg,
      _field: vi.fn(() => [0, 0x20] as [number, number]),
    })

    const result = renderAnsiScreen(tnz)
    // Position 0 should have color code 34 (blue)
    expect(result).toContain('\x1B[0;34m')
  })

  it('should apply default color 94 for protected fields without fg color', () => {
    const tnz = createMockTnz({
      _field: vi.fn(() => [0, 0x20] as [number, number]), // protected
    })

    const result = renderAnsiScreen(tnz)
    // Protected field, not intensified => default color 94
    expect(result).toContain(';94m')
  })

  it('should apply default color 36 for unprotected fields without fg color', () => {
    const tnz = createMockTnz({
      _field: vi.fn(() => [0, 0x00] as [number, number]), // unprotected
    })

    const result = renderAnsiScreen(tnz)
    // Unprotected, not intensified => default color 36
    expect(result).toContain(';36m')
  })

  it('should apply intensified attribute (bold) when fattr bit 0x08 is set and not hidden', () => {
    const tnz = createMockTnz({
      _field: vi.fn(() => [0, 0x28] as [number, number]), // protected + intensified
    })

    const result = renderAnsiScreen(tnz)
    // Intensified adds '1' code, and intensified protected gets '97'
    expect(result).toContain('\x1B[0;1;97m')
  })

  it('should apply blink attribute when planeEh is 0xf1', () => {
    const bufferSize = 80 * 24
    const text = 'B'.repeat(bufferSize)
    const planeEh = new Uint8Array(bufferSize)
    planeEh[0] = 0xf1

    const tnz = createMockTnz({
      scrstr: vi.fn(() => text),
      planeEh,
      _field: vi.fn(() => [0, 0x20] as [number, number]),
    })

    const result = renderAnsiScreen(tnz)
    // eh=0xf1 adds blink code '5'
    expect(result).toContain(';5m') // blink
  })

  it('should apply reverse video attribute when planeEh is 0xf2', () => {
    const bufferSize = 80 * 24
    const text = 'R'.repeat(bufferSize)
    const planeEh = new Uint8Array(bufferSize)
    planeEh[0] = 0xf2

    const tnz = createMockTnz({
      scrstr: vi.fn(() => text),
      planeEh,
      _field: vi.fn(() => [0, 0x20] as [number, number]),
    })

    const result = renderAnsiScreen(tnz)
    // eh=0xf2 adds reverse video code '7'
    expect(result).toContain(';7m')
  })

  it('should underline unprotected field positions based on content', () => {
    const maxCol = 80
    const maxRow = 24
    const bufferSize = maxCol * maxRow
    const textArr = ' '.repeat(bufferSize).split('')
    // Put content at position 1: "Hi"
    textArr[1] = 'H'
    textArr[2] = 'i'
    const text = textArr.join('')

    const planeFa = new Uint8Array(bufferSize)
    planeFa[0] = 1 // field attribute at position 0

    const tnz = createMockTnz({
      scrstr: vi.fn(() => text),
      planeFa,
      // Field at 0 is unprotected (not protected, not hidden)
      _field: vi.fn((_i: number) => [0, 0x00] as [number, number]),
      fields: vi.fn(function* () {
        yield [0, 0x00] as [number, number] // unprotected field at position 0
      }),
      nextField: vi.fn((_pos: number) => [10] as [number]), // next field at 10
    })

    const result = renderAnsiScreen(tnz)
    // Underline code '4' should appear for unprotected fields
    expect(result).toContain(';4m')
  })

  it('should apply underline from planeEh 0xf4 for non-space characters', () => {
    const bufferSize = 80 * 24
    const textArr = ' '.repeat(bufferSize).split('')
    textArr[3] = 'X'
    const text = textArr.join('')

    const planeEh = new Uint8Array(bufferSize)
    planeEh[3] = 0xf4

    const tnz = createMockTnz({
      scrstr: vi.fn(() => text),
      planeEh,
      _field: vi.fn(() => [0, 0x20] as [number, number]),
      fields: vi.fn(function* () {}),
    })

    const result = renderAnsiScreen(tnz)
    // eh=0xf4 adds underline for non-space chars
    expect(result).toContain(';4m')
  })

  it('should NOT apply planeEh 0xf4 underline for space characters', () => {
    const bufferSize = 80 * 24
    const text = ' '.repeat(bufferSize) // all spaces
    const planeEh = new Uint8Array(bufferSize)
    planeEh[3] = 0xf4

    const tnz = createMockTnz({
      scrstr: vi.fn(() => text),
      planeEh,
      _field: vi.fn(() => [0, 0x20] as [number, number]),
      fields: vi.fn(function* () {}),
    })

    const result = renderAnsiScreen(tnz)
    // Split the output into per-character escape sequences
    // Position 3 is a space, so eh=0xf4 should NOT add underline
    // Extract the escape code for position 3 (4th char on first row)
    const segments = result.split('\x1B[0;')
    // segments[4] should be for position 3 (0-indexed), no ';4' before 'm'
    // Check that position 3's escape code doesn't include ';4m' or ';4;'
    const seg = segments[4] // position 3 escape
    // It should end with color code + 'm' + space but no '4' underline
    expect(seg).not.toMatch(/[;]4[m;]/)
  })
})
