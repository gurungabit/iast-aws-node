import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('tnz3270-node', () => ({
  Ati: class {},
}))

import { Ati } from 'tnz3270-node'
import { Session } from '@src/ast/session.js'

function createMockTnz(screenText: string, fieldAttrs: [number, number][] = []) {
  return {
    bufferSize: 80 * 43,
    maxCol: 80,
    curadd: 0,
    scrstr: vi.fn().mockReturnValue(screenText),
    keyEraseEof: vi.fn(),
    keyData: vi.fn(),
    fields: vi.fn(function* () {
      for (const [addr, fattr] of fieldAttrs) {
        yield [addr, fattr] as [number, number]
      }
    }),
  }
}

function createMockAti(mockTnz?: ReturnType<typeof createMockTnz>) {
  return Object.assign(new Ati(), {
    send: vi.fn().mockResolvedValue(undefined),
    wait: vi.fn().mockResolvedValue(1),
    scrhas: vi.fn().mockReturnValue(false),
    extract: vi.fn().mockReturnValue(' '.repeat(80)),
    maxRow: 43,
    maxCol: 80,
    keyLock: false,
    getTnz: vi.fn().mockReturnValue(mockTnz ?? null),
  })
}

/** Helper: make extract return screen data containing given text at row 1 */
function setScreen(ati: ReturnType<typeof createMockAti>, content: string) {
  const fullScreen = content + ' '.repeat(Math.max(0, 80 * 43 - content.length))
  ati.extract.mockImplementation((length: number, row: number) => {
    const startIdx = (row - 1) * 80
    return fullScreen.slice(startIdx, startIdx + length)
  })
}

describe('Session', () => {
  let ati: ReturnType<typeof createMockAti>
  let session: Session

  beforeEach(() => {
    ati = createMockAti()
    session = new Session(ati)
  })

  describe('enter()', () => {
    it('sends [enter] when called without text', async () => {
      await session.enter()
      expect(ati.send).toHaveBeenCalledWith('[enter]')
    })

    it('sends text followed by [enter] when called with text', async () => {
      await session.enter('hello')
      expect(ati.send).toHaveBeenCalledWith('hello[enter]')
    })
  })

  describe('key actions', () => {
    it('clear() sends [clear]', async () => {
      await session.clear()
      expect(ati.send).toHaveBeenCalledWith('[clear]')
    })

    it('tab() sends [tab]', async () => {
      await session.tab()
      expect(ati.send).toHaveBeenCalledWith('[tab]')
    })

    it('backtab() sends [backtab]', async () => {
      await session.backtab()
      expect(ati.send).toHaveBeenCalledWith('[backtab]')
    })

    it('pf(n) sends [pfN]', async () => {
      await session.pf(3)
      expect(ati.send).toHaveBeenCalledWith('[pf3]')
      await session.pf(15)
      expect(ati.send).toHaveBeenCalledWith('[pf15]')
    })

    it('pa(n) sends [paN]', async () => {
      await session.pa(1)
      expect(ati.send).toHaveBeenCalledWith('[pa1]')
      await session.pa(3)
      expect(ati.send).toHaveBeenCalledWith('[pa3]')
    })
  })

  describe('type()', () => {
    it('sends the raw text', async () => {
      await session.type('FIRE06')
      expect(ati.send).toHaveBeenCalledWith('FIRE06')
    })
  })

  describe('fillFieldAtPosition()', () => {
    it('sends text with row/col position', async () => {
      await session.fillFieldAtPosition(10, 20, 'value')
      expect(ati.send).toHaveBeenCalledWith('value', [10, 20])
    })
  })

  describe('fillFieldByLabel()', () => {
    it('returns true and fills field when label is found with unprotected field', async () => {
      // Screen: "Userid" at col 0, then field attribute at col 9 (protected=false), field data starts at col 10
      // FA byte at address 9 (0x00 = unprotected), field data at address 10
      const screenText = 'Userid    ' + ' '.repeat(80 * 43 - 10)
      const mockTnz = createMockTnz(screenText, [
        [9, 0x00],   // unprotected field at address 9 (data starts at 10, col 10)
        [79, 0x20],  // protected field wrapping around
      ])
      ati.getTnz.mockReturnValue(mockTnz)

      const result = await session.fillFieldByLabel('Userid', 'testuser')
      expect(result).toBe(true)
      expect(mockTnz.curadd).toBe(10)
      expect(mockTnz.keyEraseEof).toHaveBeenCalled()
      expect(mockTnz.keyData).toHaveBeenCalledWith('testuser')
    })

    it('returns false when label is not found', async () => {
      const screenText = ' '.repeat(80 * 43)
      const mockTnz = createMockTnz(screenText, [[9, 0x00], [79, 0x20]])
      ati.getTnz.mockReturnValue(mockTnz)

      const result = await session.fillFieldByLabel('Nonexistent', 'value')
      expect(result).toBe(false)
      expect(mockTnz.keyData).not.toHaveBeenCalled()
    })

    it('returns false when no tnz instance', async () => {
      ati.getTnz.mockReturnValue(undefined)
      const result = await session.fillFieldByLabel('Userid', 'value')
      expect(result).toBe(false)
    })

    it('returns false when no unprotected fields exist', async () => {
      const screenText = 'Userid    ' + ' '.repeat(80 * 43 - 10)
      const mockTnz = createMockTnz(screenText, [
        [9, 0x20],   // protected
        [79, 0x20],  // protected
      ])
      ati.getTnz.mockReturnValue(mockTnz)

      const result = await session.fillFieldByLabel('Userid', 'value')
      expect(result).toBe(false)
    })

    it('picks the closest unprotected field after the label', async () => {
      // "Userid" at col 0, unprotected field at col 20, another at col 50
      const screenText = 'Userid' + ' '.repeat(80 * 43 - 6)
      const mockTnz = createMockTnz(screenText, [
        [19, 0x00],  // unprotected: data starts at 20 (col 20) - closer to label
        [49, 0x00],  // unprotected: data starts at 50 (col 50)
        [79, 0x20],  // protected end marker
      ])
      ati.getTnz.mockReturnValue(mockTnz)

      const result = await session.fillFieldByLabel('Userid', 'user1')
      expect(result).toBe(true)
      expect(mockTnz.curadd).toBe(20) // picked the closer field
      expect(mockTnz.keyData).toHaveBeenCalledWith('user1')
    })
  })

  describe('waitForText()', () => {
    it('returns true when wait succeeds (rc !== 0)', async () => {
      ati.wait.mockResolvedValue(1)
      const result = await session.waitForText('Ready')
      expect(result).toBe(true)
      expect(ati.wait).toHaveBeenCalledWith(10, expect.any(Function))
    })

    it('returns false when wait times out (rc === 0)', async () => {
      ati.wait.mockResolvedValue(0)
      const result = await session.waitForText('Ready', 5)
      expect(result).toBe(false)
      expect(ati.wait).toHaveBeenCalledWith(5, expect.any(Function))
    })

    it('matches case-insensitively by default', async () => {
      ati.wait.mockImplementation(async (_t: number, fn: () => boolean) => {
        return fn() ? 1 : 0
      })
      setScreen(ati, 'FIRE SYSTEM SELECTION')
      const result = await session.waitForText('Fire System Selection')
      expect(result).toBe(true)
    })

    it('matches case-sensitively when specified', async () => {
      ati.wait.mockImplementation(async (_t: number, fn: () => boolean) => {
        return fn() ? 1 : 0
      })
      ati.scrhas.mockReturnValue(false)
      const result = await session.waitForText('Fire System Selection', 5, true)
      expect(result).toBe(false)
    })
  })

  describe('waitForTextOrThrow()', () => {
    it('does not throw when text is found', async () => {
      ati.wait.mockResolvedValue(1)
      await expect(session.waitForTextOrThrow('Ready')).resolves.toBeUndefined()
    })

    it('throws on timeout', async () => {
      ati.wait.mockResolvedValue(0)
      await expect(session.waitForTextOrThrow('Ready')).rejects.toThrow(
        'Timeout waiting for "Ready"',
      )
    })
  })

  describe('waitForTextGone()', () => {
    it('returns true when text disappears', async () => {
      ati.wait.mockImplementation(async (_t: number, fn: () => boolean) => {
        return fn() ? 1 : 0
      })
      // Screen doesn't contain "Loading"
      const result = await session.waitForTextGone('Loading')
      expect(result).toBe(true)
    })
  })

  describe('waitForKeyboard()', () => {
    it('waits until keyLock is false', async () => {
      ati.wait.mockResolvedValue(1)
      const result = await session.waitForKeyboard()
      expect(result).toBe(true)
      const conditionFn = ati.wait.mock.calls[0][1]
      ati.keyLock = true
      expect(conditionFn()).toBe(false)
      ati.keyLock = false
      expect(conditionFn()).toBe(true)
    })
  })

  describe('waitForAnyText()', () => {
    it('returns the first matched text', async () => {
      ati.wait.mockImplementation(async (_t: number, fn: () => boolean) => {
        fn()
        return 1
      })
      setScreen(ati, 'Ready')
      const result = await session.waitForAnyText(['Error', 'Ready', 'Done'])
      expect(result).toBe('Ready')
    })

    it('returns null when no text matches', async () => {
      ati.wait.mockResolvedValue(0)
      const result = await session.waitForAnyText(['Error', 'Ready'])
      expect(result).toBe(null)
    })
  })

  describe('screen reading', () => {
    it('hasText() is case-insensitive by default', () => {
      setScreen(ati, 'HELLO WORLD')
      expect(session.hasText('hello world')).toBe(true)
    })

    it('hasText() can be case-sensitive', () => {
      ati.scrhas.mockReturnValue(false)
      expect(session.hasText('Hello', true)).toBe(false)
    })

    it('screenContains() is case-insensitive by default', () => {
      setScreen(ati, 'Fire System Selection')
      expect(session.screenContains('FIRE SYSTEM SELECTION')).toBe(true)
    })

    it('getTextAt() calls extract with correct args', () => {
      ati.extract.mockReturnValue('FIRE06')
      expect(session.getTextAt(5, 10, 6)).toBe('FIRE06')
      expect(ati.extract).toHaveBeenCalledWith(6, 5, 10)
    })

    it('getRow() extracts full row width', () => {
      ati.extract.mockReturnValue('A'.repeat(80))
      const row = session.getRow(3)
      expect(row).toBe('A'.repeat(80))
      expect(ati.extract).toHaveBeenCalledWith(80, 3, 1)
    })

    it('getFullScreen() joins all rows', () => {
      ati.extract.mockImplementation((_len: number, row: number) => `row${row}${'_'.repeat(76)}`)
      const screen = session.getFullScreen()
      expect(screen).toContain('row1')
      expect(screen).toContain('row43')
      expect(ati.extract).toHaveBeenCalledTimes(43)
    })

    it('rows and cols return ati dimensions', () => {
      expect(session.rows).toBe(43)
      expect(session.cols).toBe(80)
    })
  })

  describe('authenticate()', () => {
    it('returns success when already at target screen', async () => {
      setScreen(ati, 'Fire System Selection')
      const result = await session.authenticate({
        username: 'user',
        password: 'pass',
        expectedKeywords: ['Fire System Selection'],
      })
      expect(result).toEqual({ success: true, error: '' })
      expect(ati.send).not.toHaveBeenCalled()
    })

    it('fills credentials and succeeds after enter', async () => {
      // Row 0: "Userid    " (10 chars) + 70 spaces = 80 chars
      // Row 1: "Password  " (10 chars) + 70 spaces = 80 chars
      const screenContent = 'Userid    ' + ' '.repeat(70) + 'Password  ' + ' '.repeat(70)
      const fullScreen = screenContent + ' '.repeat(80 * 43 - screenContent.length)
      setScreen(ati, screenContent)

      // Field attributes: unprotected fields after "Userid" and "Password" labels
      const mockTnz = createMockTnz(fullScreen, [
        [9, 0x00],   // unprotected field after Userid (data at col 10, row 0)
        [79, 0x20],  // protected separator
        [89, 0x00],  // unprotected field after Password (data at col 10, row 1)
        [159, 0x20], // protected separator
      ])
      ati.getTnz.mockReturnValue(mockTnz)
      ati.wait.mockResolvedValue(1)

      const result = await session.authenticate({
        username: 'user1',
        password: 'pass1',
        expectedKeywords: ['Fire System Selection'],
      })
      expect(result.success).toBe(true)
      expect(mockTnz.keyData).toHaveBeenCalledWith('user1')
      expect(mockTnz.keyData).toHaveBeenCalledWith('pass1')
    })

    it('returns failure when expected keywords not found after login', async () => {
      const screenContent = 'Userid    ' + ' '.repeat(70) + 'Password  ' + ' '.repeat(70)
      const fullScreen = screenContent + ' '.repeat(80 * 43 - screenContent.length)
      setScreen(ati, screenContent)

      const mockTnz = createMockTnz(fullScreen, [
        [9, 0x00],
        [79, 0x20],
        [89, 0x00],
        [159, 0x20],
      ])
      ati.getTnz.mockReturnValue(mockTnz)
      ati.wait.mockResolvedValue(0) // timeout

      const result = await session.authenticate({
        username: 'user1',
        password: 'pass1',
        expectedKeywords: ['Fire System Selection'],
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Expected keywords not found')
    })
  })

  describe('logoff()', () => {
    it('sends pa3 when usePa3 is true', async () => {
      ati.wait.mockResolvedValue(1)
      setScreen(ati, 'Exit Menu')

      await session.logoff({ usePa3: true })
      expect(ati.send).toHaveBeenCalledWith('[pa3]')
    })

    it('navigates to Exit Menu and logs off successfully', async () => {
      ati.wait.mockResolvedValue(1)

      const result = await session.logoff()
      expect(result).toEqual({ success: true, error: '' })
      expect(ati.send).toHaveBeenCalledWith('1', [36, 5])
      expect(ati.send).toHaveBeenCalledWith('[enter]')
    })

    it('returns failure when target keywords not found', async () => {
      ati.wait.mockResolvedValue(0)

      const result = await session.logoff()
      expect(result).toEqual({ success: false, error: 'Failed to sign off' })
    })
  })
})
