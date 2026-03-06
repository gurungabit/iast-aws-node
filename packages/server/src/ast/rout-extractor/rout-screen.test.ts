import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSessionMethods = vi.hoisted(() => ({
  screenContains: vi.fn().mockReturnValue(false),
  getTextAt: vi.fn().mockReturnValue(''),
  pf: vi.fn().mockResolvedValue(undefined),
  pa: vi.fn().mockResolvedValue(undefined),
  enter: vi.fn().mockResolvedValue(undefined),
  waitForText: vi.fn().mockResolvedValue(true),
  waitForKeyboard: vi.fn().mockResolvedValue(true),
  waitForAnyText: vi.fn().mockResolvedValue(null),
  fillFieldAtPosition: vi.fn().mockResolvedValue(undefined),
  getRow: vi.fn().mockReturnValue(' '.repeat(80)),
  getFullScreen: vi.fn().mockReturnValue(' '.repeat(80 * 43)),
  rows: 43,
  cols: 80,
}))

vi.mock('tnz3270-node', () => ({ Ati: class {} }))
vi.mock('../session.js', () => ({
  Session: function () {
    return mockSessionMethods
  },
}))

vi.mock('./filters.js', () => ({
  applyAllFilters: vi.fn().mockImplementation((items: unknown[]) => items),
}))

import { Ati } from 'tnz3270-node'
import { Session } from '../session.js'
import { RoutScreen } from './rout-screen.js'

describe('RoutScreen', () => {
  let mockSession: typeof mockSessionMethods
  let routScreen: RoutScreen

  beforeEach(() => {
    vi.clearAllMocks()
    mockSession = mockSessionMethods
    routScreen = new RoutScreen(new Session(new Ati()))
  })

  describe('screen detection', () => {
    it('isRoutControl() checks for ROUT control title', () => {
      mockSession.screenContains.mockImplementation(
        (text: string) => text === 'FIRE TERMINAL ROUTING CONTROL SCREEN',
      )
      expect(routScreen.isRoutControl()).toBe(true)
    })

    it('isDetailListing() checks for detail listing title', () => {
      mockSession.screenContains.mockImplementation(
        (text: string) => text === 'FIRE TERMINAL ROUTING DETAIL LISTING SCREEN',
      )
      expect(routScreen.isDetailListing()).toBe(true)
    })

    it('isQueueListing() checks for queue listing marker', () => {
      mockSession.screenContains.mockImplementation(
        (text: string) => text === 'FIRE TERMINAL ROUTING QUEUE LISTING SCREEN',
      )
      expect(routScreen.isQueueListing()).toBe(true)
    })

    it('hasMultiAccessWarning() checks for warning text', () => {
      mockSession.screenContains.mockImplementation(
        (text: string) => text === 'TERMINAL ROUTING MULTIPLE ACCESS WARNING',
      )
      expect(routScreen.hasMultiAccessWarning()).toBe(true)
    })

    it('hasNoMoreOccs() checks for no more assignments text', () => {
      mockSession.screenContains.mockImplementation(
        (text: string) => text === 'NO ADDITIONAL WORK ASSIGNMENTS',
      )
      expect(routScreen.hasNoMoreOccs()).toBe(true)
    })

    it('isFss() checks for Fire System Selection', () => {
      mockSession.screenContains.mockImplementation(
        (text: string) => text === 'Fire System Selection',
      )
      expect(routScreen.isFss()).toBe(true)
    })
  })

  describe('goToRoutControl()', () => {
    it('returns true immediately if already on RoutControl', async () => {
      mockSession.screenContains.mockImplementation(
        (text: string) => text === 'FIRE TERMINAL ROUTING CONTROL SCREEN',
      )
      const result = await routScreen.goToRoutControl()
      expect(result).toBe(true)
      expect(mockSession.pf).not.toHaveBeenCalled()
    })

    it('navigates by pressing PF15 until RoutControl is reached', async () => {
      let callCount = 0
      mockSession.screenContains.mockImplementation((text: string) => {
        if (text === 'FIRE TERMINAL ROUTING CONTROL SCREEN') {
          callCount++
          return callCount > 3 // Takes 3 tries
        }
        return false
      })
      mockSession.waitForText.mockResolvedValue(false)

      const result = await routScreen.goToRoutControl()
      expect(result).toBe(true)
      expect(mockSession.pf).toHaveBeenCalledWith(15)
    })
  })

  describe('dismissMultiAccessWarning()', () => {
    it('returns true if no warning present', async () => {
      mockSession.screenContains.mockReturnValue(false)
      const result = await routScreen.dismissMultiAccessWarning()
      expect(result).toBe(true)
      expect(mockSession.enter).not.toHaveBeenCalled()
    })

    it('presses enter to dismiss warning', async () => {
      let warningDismissed = false
      mockSession.screenContains.mockImplementation((text: string) => {
        if (text === 'TERMINAL ROUTING MULTIPLE ACCESS WARNING') {
          if (!warningDismissed) {
            warningDismissed = true
            return true
          }
          return false
        }
        return false
      })

      const result = await routScreen.dismissMultiAccessWarning()
      expect(result).toBe(true)
      expect(mockSession.enter).toHaveBeenCalled()
      expect(mockSession.waitForKeyboard).toHaveBeenCalledWith(2)
    })
  })

  describe('getCurrentOccurrence()', () => {
    it('extracts occurrence text from row 8', () => {
      mockSession.getTextAt.mockReturnValue('  OCC 5 - CLAIMS  ')
      const result = routScreen.getCurrentOccurrence()
      expect(result).toBe('OCC 5 - CLAIMS')
      expect(mockSession.getTextAt).toHaveBeenCalledWith(8, 1, 43)
    })
  })

  describe('getCurrentOccNumber()', () => {
    it('parses OCC number from text', () => {
      mockSession.getTextAt.mockReturnValue('  OCC  5 - CLAIMS  ')
      expect(routScreen.getCurrentOccNumber()).toBe(5)
    })

    it('returns null when no OCC number found', () => {
      mockSession.getTextAt.mockReturnValue('  NO OCC HERE  ')
      expect(routScreen.getCurrentOccNumber()).toBe(null)
    })
  })

  describe('listQueuesInSection()', () => {
    it('extracts queues from screen rows 12-41', () => {
      mockSession.getTextAt.mockImplementation((row: number, col: number, _len: number) => {
        if (row === 12) {
          if (col === 4) return '001'
          if (col === 9) return 'ERROR QUEUE    '
          if (col === 26) return 'EMP TYPE       '
          if (col === 46) return '  5'
        }
        if (row === 13) {
          if (col === 4) return '002'
          if (col === 9) return 'GFU QUEUE      '
          if (col === 26) return 'EMP TYPE 2     '
          if (col === 46) return '  0' // activeCount = 0, should be excluded
        }
        return ''
      })

      const queues = routScreen.listQueuesInSection()
      expect(queues).toHaveLength(1)
      expect(queues[0]).toEqual({
        queueNum: '001',
        queueName: 'ERROR QUEUE',
        queueAndEmpType: 'EMP TYPE',
        activeItemCount: 5,
      })
    })

    it('returns empty array when no valid queue rows', () => {
      mockSession.getTextAt.mockReturnValue('')
      const queues = routScreen.listQueuesInSection()
      expect(queues).toHaveLength(0)
    })
  })

  describe('enterQueue()', () => {
    it('returns false if not on RoutControl or QueueListing', async () => {
      mockSession.screenContains.mockReturnValue(false)
      const result = await routScreen.enterQueue('001')
      expect(result).toBe(false)
    })

    it('fills queue number and enters, returns true on detail listing', async () => {
      mockSession.screenContains.mockImplementation((text: string) => {
        if (text === 'FIRE TERMINAL ROUTING CONTROL SCREEN') return true
        if (text === 'FIRE TERMINAL ROUTING DETAIL LISTING SCREEN') return true
        return false
      })

      const result = await routScreen.enterQueue('001')
      expect(result).toBe(true)
      expect(mockSession.fillFieldAtPosition).toHaveBeenCalledWith(6, 9, 'L001')
      expect(mockSession.enter).toHaveBeenCalled()
    })
  })

  describe('returnToRoutControl()', () => {
    it('returns true when already on RoutControl', async () => {
      mockSession.screenContains.mockImplementation(
        (text: string) => text === 'FIRE TERMINAL ROUTING CONTROL SCREEN',
      )
      const result = await routScreen.returnToRoutControl()
      expect(result).toBe(true)
    })
  })

  describe('cycleOcc()', () => {
    it('presses PF23 and returns true when more OCCs available', async () => {
      mockSession.screenContains.mockReturnValue(false)
      const result = await routScreen.cycleOcc()
      expect(result).toBe(true)
      expect(mockSession.pf).toHaveBeenCalledWith(23)
      expect(mockSession.waitForKeyboard).toHaveBeenCalledWith(3)
    })

    it('returns false when no more OCCs', async () => {
      mockSession.screenContains.mockImplementation(
        (text: string) => text === 'NO ADDITIONAL WORK ASSIGNMENTS',
      )
      const result = await routScreen.cycleOcc()
      expect(result).toBe(false)
    })
  })

  describe('isPdqControl()', () => {
    it('checks for PDQ Control title', () => {
      mockSession.screenContains.mockImplementation(
        (text: string) => text === 'PDQ Control',
      )
      expect(routScreen.isPdqControl()).toBe(true)
    })
  })

  describe('isPdqName()', () => {
    it('checks for PDQ Name title', () => {
      mockSession.screenContains.mockImplementation(
        (text: string) => text === 'PDQ - Name and Address',
      )
      expect(routScreen.isPdqName()).toBe(true)
    })
  })

  describe('findSection()', () => {
    it('returns true when section is on current page', async () => {
      mockSession.screenContains.mockImplementation(
        (text: string) => text === 'ROUTED ITEMS',
      )
      const result = await routScreen.findSection('routed items')
      expect(result).toBe(true)
    })

    it('pages forward to find section', async () => {
      let pageCount = 0
      mockSession.screenContains.mockImplementation((text: string) => {
        if (text === 'NO ADDITIONAL WORK ASSIGNMENTS') return false
        if (text === 'ROUTED ITEMS') {
          pageCount++
          return pageCount > 2
        }
        return false
      })

      const result = await routScreen.findSection('routed items')
      expect(result).toBe(true)
      expect(mockSession.pf).toHaveBeenCalledWith(14)
    })

    it('returns false when section not found and no more OCCs', async () => {
      mockSession.screenContains.mockImplementation(
        (text: string) => text === 'NO ADDITIONAL WORK ASSIGNMENTS',
      )
      const result = await routScreen.findSection('nonexistent')
      expect(result).toBe(false)
    })

    it('returns false after max pages', async () => {
      mockSession.screenContains.mockReturnValue(false)
      const result = await routScreen.findSection('never found')
      expect(result).toBe(false)
      expect(mockSession.pf).toHaveBeenCalledTimes(15)
    })
  })

  describe('readDetailItems()', () => {
    it('reads items from detail pages', async () => {
      // Set up a screen with one detail row
      mockSession.getTextAt.mockImplementation((row: number, col: number, _len: number) => {
        if (row === 12) {
          if (col === 1) return '   1'  // item number
          if (col === 7) return 'A12345678901' // 12+ chars policy raw (padded)
          if (col === 23) return 'T01'
          if (col === 28) return '1234'
          if (col === 33) return 'AF'
          if (col === 37) return 'HOME'
          if (col === 63) return 'Description here  '
        }
        return ''
      })

      // Detail listing on first check, not on second (end of data)
      let detailCallCount = 0
      mockSession.screenContains.mockImplementation((text: string) => {
        if (text === 'FIRE TERMINAL ROUTING DETAIL LISTING SCREEN') {
          detailCallCount++
          return detailCallCount <= 1
        }
        return false
      })

      const items = await routScreen.readDetailItems('ERROR MEMOS', 'Queue1', '1')
      expect(items.length).toBeGreaterThanOrEqual(1)
      expect(items[0]).toEqual(expect.objectContaining({
        sectionOfRout: 'ERROR MEMOS',
        queueName: 'Queue1',
        occurNum: '1',
        team: 'T01',
        agent: '1234',
        afo: 'AF',
        policyType: 'HOME',
        description: 'Description here',
      }))
    })

    it('returns empty when no detail rows found', async () => {
      mockSession.getTextAt.mockReturnValue('')
      const items = await routScreen.readDetailItems('SECTION', 'Queue', '1')
      expect(items).toHaveLength(0)
    })
  })

  describe('lookupPdqType()', () => {
    it('returns null for invalid policy number format', async () => {
      const result = await routScreen.lookupPdqType('invalid')
      expect(result).toBeNull()
    })

    it('navigates FSS → PDQ → reads type → back out', async () => {
      mockSession.screenContains.mockImplementation((text: string) => {
        if (text === 'Fire System Selection') return true
        if (text === 'PDQ Control') return false
        if (text === 'PDQ - Name and Address') return false
        return false
      })
      mockSession.waitForText.mockResolvedValue(true)
      mockSession.waitForAnyText.mockResolvedValue('PDQ - Name and Address')
      mockSession.getTextAt.mockImplementation((row: number, col: number) => {
        if (row === 6 && col === 59) return 'HOMEOWNERS        '
        if (row === 8 && col === 1) return ''
        return ''
      })

      const result = await routScreen.lookupPdqType('AB-CD-1234-5', 'X')
      expect(result).toBe('HOMEOWNERS')
    })

    it('returns null when PDQ record not found', async () => {
      mockSession.screenContains.mockImplementation((text: string) => {
        if (text === 'Fire System Selection') return true
        if (text === 'NO FMR RECORD FOUND') return true
        return false
      })
      mockSession.waitForText.mockResolvedValue(true)
      mockSession.waitForAnyText.mockResolvedValue('NO FMR RECORD FOUND')

      const result = await routScreen.lookupPdqType('AB-CD-1234-5')
      expect(result).toBeNull()
    })

    it('returns null when not on FSS and cannot navigate there', async () => {
      mockSession.screenContains.mockReturnValue(false)
      mockSession.waitForText.mockResolvedValue(false)

      const result = await routScreen.lookupPdqType('AB-CD-1234-5')
      expect(result).toBeNull()
    })

    it('returns null on error and backs out to FSS', async () => {
      mockSession.screenContains.mockImplementation((text: string) => {
        if (text === 'Fire System Selection') return true
        return false
      })
      mockSession.waitForText.mockRejectedValue(new Error('timeout'))

      const result = await routScreen.lookupPdqType('AB-CD-1234-5')
      expect(result).toBeNull()
    })

    it('returns null when type field is empty', async () => {
      mockSession.screenContains.mockImplementation((text: string) => {
        if (text === 'Fire System Selection') return true
        return false
      })
      mockSession.waitForText.mockResolvedValue(true)
      mockSession.waitForAnyText.mockResolvedValue('PDQ - Name and Address')
      mockSession.getTextAt.mockReturnValue('                  ')

      const result = await routScreen.lookupPdqType('AB-CD-1234-5')
      expect(result).toBeNull()
    })
  })

  describe('processRoutItem()', () => {
    it('returns error when cannot navigate to RoutControl', async () => {
      mockSession.screenContains.mockReturnValue(false)
      mockSession.waitForText.mockResolvedValue(false)

      const result = await routScreen.processRoutItem({ occ: 1, section: 'TEST' }, null)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to navigate to RoutControl')
    })

    it('dismisses multi-access warning if present', async () => {
      let warningCalls = 0

      mockSession.screenContains.mockImplementation((text: string) => {
        if (text === 'FIRE TERMINAL ROUTING CONTROL SCREEN') return true
        if (text === 'TERMINAL ROUTING MULTIPLE ACCESS WARNING') {
          warningCalls++
          // First two calls return true (check + dismiss check), then false
          return warningCalls <= 1
        }
        if (text === 'NO ADDITIONAL WORK ASSIGNMENTS') return true
        return false
      })
      mockSession.getTextAt.mockReturnValue('  OCC  1 - TEST  ')

      const result = await routScreen.processRoutItem({ occ: 1, section: 'NOT FOUND' }, null)
      expect(result.success).toBe(true)
      // Warning was detected, so enter was called to dismiss it
      expect(warningCalls).toBeGreaterThan(0)
    })

    it('returns success with empty items when section not found', async () => {
      mockSession.screenContains.mockImplementation((text: string) => {
        if (text === 'FIRE TERMINAL ROUTING CONTROL SCREEN') return true
        if (text === 'NO ADDITIONAL WORK ASSIGNMENTS') return true
        return false
      })
      mockSession.getTextAt.mockReturnValue('  OCC  1 - TEST  ')

      const result = await routScreen.processRoutItem({ occ: 1, section: 'MISSING' }, null)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(expect.objectContaining({ items: [], count: 0 }))
    })

    it('returns error when OCC not found', async () => {
      mockSession.screenContains.mockImplementation((text: string) => {
        if (text === 'FIRE TERMINAL ROUTING CONTROL SCREEN') return true
        if (text === 'NO ADDITIONAL WORK ASSIGNMENTS') return true
        return false
      })
      mockSession.getTextAt.mockReturnValue('  OCC  1 - TEST  ')

      const result = await routScreen.processRoutItem({ occ: 5, section: 'TEST' }, null)
      expect(result.success).toBe(false)
      expect(result.error).toContain('OCC 5 not found')
    })

    it('catches errors during processing', async () => {
      mockSession.screenContains.mockImplementation((text: string) => {
        if (text === 'FIRE TERMINAL ROUTING CONTROL SCREEN') return true
        return false
      })
      mockSession.getTextAt.mockImplementation(() => {
        throw new Error('Screen read error')
      })

      const result = await routScreen.processRoutItem({ occ: 1, section: 'TEST' }, null)
      expect(result.success).toBe(false)
      expect(result.error).toContain('ROUT processing error')
    })

    it('processes queues when section is found', async () => {
      // Set up: on RoutControl, OCC matches, section found, no queues
      mockSession.screenContains.mockImplementation((text: string) => {
        if (text === 'FIRE TERMINAL ROUTING CONTROL SCREEN') return true
        if (text === 'ROUTED ITEMS') return true
        return false
      })
      mockSession.getTextAt.mockImplementation((row: number, col: number) => {
        if (row === 8 && col === 1) return '  OCC  1 - TEST  '
        return ''
      })

      const result = await routScreen.processRoutItem({ occ: 1, section: 'ROUTED ITEMS' }, null)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(expect.objectContaining({ occ: 1, section: 'ROUTED ITEMS', count: 0 }))
    })
  })
})
