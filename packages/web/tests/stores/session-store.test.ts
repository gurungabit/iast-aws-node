import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSessionStore } from '@src/stores/session-store'
import { act } from '@testing-library/react'

describe('useSessionStore', () => {
  beforeEach(() => {
    act(() => {
      useSessionStore.setState({ tabs: new Map(), activeTabId: null })
    })
  })

  describe('addTab', () => {
    it('adds a new tab and sets it as active', () => {
      act(() => {
        useSessionStore.getState().addTab('s1', 'Session 1')
      })

      const state = useSessionStore.getState()
      expect(state.tabs.size).toBe(1)
      expect(state.activeTabId).toBe('s1')

      const tab = state.tabs.get('s1')
      expect(tab).toBeDefined()
      expect(tab!.sessionId).toBe('s1')
      expect(tab!.name).toBe('Session 1')
      expect(tab!.ws).toBeNull()
      expect(tab!.connected).toBe(false)
      expect(tab!.screenAnsi).toBe('')
      expect(tab!.meta).toEqual({ cursorRow: 1, cursorCol: 1, locked: false, rows: 43, cols: 80 })
    })

    it('adds multiple tabs, last one becomes active', () => {
      act(() => {
        useSessionStore.getState().addTab('s1', 'Session 1')
        useSessionStore.getState().addTab('s2', 'Session 2')
      })

      const state = useSessionStore.getState()
      expect(state.tabs.size).toBe(2)
      expect(state.activeTabId).toBe('s2')
    })
  })

  describe('removeTab', () => {
    it('removes a tab', () => {
      act(() => {
        useSessionStore.getState().addTab('s1', 'Session 1')
        useSessionStore.getState().addTab('s2', 'Session 2')
        useSessionStore.getState().removeTab('s1')
      })

      const state = useSessionStore.getState()
      expect(state.tabs.size).toBe(1)
      expect(state.tabs.has('s1')).toBe(false)
    })

    it('switches activeTabId when removing active tab', () => {
      act(() => {
        useSessionStore.getState().addTab('s1', 'Session 1')
        useSessionStore.getState().addTab('s2', 'Session 2')
        useSessionStore.getState().setActiveTab('s2')
        useSessionStore.getState().removeTab('s2')
      })

      const state = useSessionStore.getState()
      expect(state.activeTabId).toBe('s1')
    })

    it('sets activeTabId to null when removing last tab', () => {
      act(() => {
        useSessionStore.getState().addTab('s1', 'Session 1')
        useSessionStore.getState().removeTab('s1')
      })

      expect(useSessionStore.getState().activeTabId).toBeNull()
    })

    it('calls disconnect on ws when removing tab with ws', () => {
      const mockDisconnect = vi.fn()
      act(() => {
        useSessionStore.getState().addTab('s1', 'Session 1')
        // Manually set ws
        const tabs = new Map(useSessionStore.getState().tabs)
        const tab = tabs.get('s1')!
        tabs.set('s1', { ...tab, ws: { disconnect: mockDisconnect } as never })
        useSessionStore.setState({ tabs })
      })

      act(() => {
        useSessionStore.getState().removeTab('s1')
      })

      expect(mockDisconnect).toHaveBeenCalled()
    })

    it('does not change activeTabId when removing non-active tab', () => {
      act(() => {
        useSessionStore.getState().addTab('s1', 'Session 1')
        useSessionStore.getState().addTab('s2', 'Session 2')
        useSessionStore.getState().setActiveTab('s2')
        useSessionStore.getState().removeTab('s1')
      })

      expect(useSessionStore.getState().activeTabId).toBe('s2')
    })
  })

  describe('setActiveTab', () => {
    it('sets the active tab', () => {
      act(() => {
        useSessionStore.getState().addTab('s1', 'Session 1')
        useSessionStore.getState().addTab('s2', 'Session 2')
        useSessionStore.getState().setActiveTab('s1')
      })

      expect(useSessionStore.getState().activeTabId).toBe('s1')
    })
  })

  describe('renameTab', () => {
    it('renames an existing tab', () => {
      act(() => {
        useSessionStore.getState().addTab('s1', 'Session 1')
        useSessionStore.getState().renameTab('s1', 'Renamed')
      })

      expect(useSessionStore.getState().tabs.get('s1')!.name).toBe('Renamed')
    })

    it('does nothing for nonexistent tab', () => {
      act(() => {
        useSessionStore.getState().renameTab('nonexistent', 'Name')
      })

      expect(useSessionStore.getState().tabs.size).toBe(0)
    })
  })

  describe('setConnected', () => {
    it('sets connected state for a tab', () => {
      act(() => {
        useSessionStore.getState().addTab('s1', 'Session 1')
        useSessionStore.getState().setConnected('s1', true)
      })

      expect(useSessionStore.getState().tabs.get('s1')!.connected).toBe(true)
    })

    it('sets disconnected state', () => {
      act(() => {
        useSessionStore.getState().addTab('s1', 'Session 1')
        useSessionStore.getState().setConnected('s1', true)
        useSessionStore.getState().setConnected('s1', false)
      })

      expect(useSessionStore.getState().tabs.get('s1')!.connected).toBe(false)
    })

    it('does nothing for nonexistent tab', () => {
      act(() => {
        useSessionStore.getState().setConnected('nonexistent', true)
      })

      expect(useSessionStore.getState().tabs.size).toBe(0)
    })
  })

  describe('updateScreen', () => {
    it('updates screen ANSI and meta for a tab', () => {
      const meta = { cursorRow: 5, cursorCol: 10, locked: true, rows: 24, cols: 80 }
      act(() => {
        useSessionStore.getState().addTab('s1', 'Session 1')
        useSessionStore.getState().updateScreen('s1', 'ansi-data', meta)
      })

      const tab = useSessionStore.getState().tabs.get('s1')!
      expect(tab.screenAnsi).toBe('ansi-data')
      expect(tab.meta).toEqual(meta)
    })

    it('does nothing for nonexistent tab', () => {
      act(() => {
        useSessionStore.getState().updateScreen('nonexistent', 'data', {
          cursorRow: 1,
          cursorCol: 1,
          locked: false,
          rows: 43,
          cols: 80,
        })
      })

      expect(useSessionStore.getState().tabs.size).toBe(0)
    })
  })

  describe('setWs', () => {
    it('sets ws for an existing tab', () => {
      const mockWs = { send: vi.fn(), disconnect: vi.fn() } as never
      act(() => {
        useSessionStore.getState().addTab('s1', 'Session 1')
        useSessionStore.getState().setWs('s1', mockWs)
      })

      expect(useSessionStore.getState().tabs.get('s1')!.ws).toBe(mockWs)
    })

    it('does nothing for nonexistent tab', () => {
      const mockWs = { send: vi.fn(), disconnect: vi.fn() } as never
      act(() => {
        useSessionStore.getState().setWs('nonexistent', mockWs)
      })

      expect(useSessionStore.getState().tabs.size).toBe(0)
    })
  })

  describe('getActiveTab', () => {
    it('returns null when no active tab', () => {
      expect(useSessionStore.getState().getActiveTab()).toBeNull()
    })

    it('returns the active tab', () => {
      act(() => {
        useSessionStore.getState().addTab('s1', 'Session 1')
      })

      const activeTab = useSessionStore.getState().getActiveTab()
      expect(activeTab).not.toBeNull()
      expect(activeTab!.sessionId).toBe('s1')
      expect(activeTab!.name).toBe('Session 1')
    })

    it('returns null if activeTabId does not exist in tabs', () => {
      act(() => {
        useSessionStore.setState({ activeTabId: 'nonexistent' })
      })

      expect(useSessionStore.getState().getActiveTab()).toBeNull()
    })
  })
})
