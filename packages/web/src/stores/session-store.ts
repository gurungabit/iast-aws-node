import { create } from 'zustand'
import { TerminalWebSocket } from '../services/websocket'

export interface SessionTab {
  sessionId: string
  name: string
  ws: TerminalWebSocket | null
  connected: boolean
  screenAnsi: string
  meta: {
    cursorRow: number
    cursorCol: number
    locked: boolean
    rows: number
    cols: number
  }
}

interface SessionState {
  tabs: Map<string, SessionTab>
  activeTabId: string | null

  addTab: (sessionId: string, name: string) => void
  removeTab: (sessionId: string) => void
  setActiveTab: (sessionId: string) => void
  renameTab: (sessionId: string, name: string) => void

  setWs: (sessionId: string, ws: TerminalWebSocket) => void
  setConnected: (sessionId: string, connected: boolean) => void
  updateScreen: (sessionId: string, ansi: string, meta: SessionTab['meta']) => void

  getActiveTab: () => SessionTab | null
}

export const useSessionStore = create<SessionState>((set, get) => ({
  tabs: new Map(),
  activeTabId: null,

  addTab: (sessionId, name) => {
    set((state) => {
      const tabs = new Map(state.tabs)
      tabs.set(sessionId, {
        sessionId,
        name,
        ws: null,
        connected: false,
        screenAnsi: '',
        meta: { cursorRow: 1, cursorCol: 1, locked: false, rows: 43, cols: 80 },
      })
      return { tabs, activeTabId: sessionId }
    })
  },

  removeTab: (sessionId) => {
    set((state) => {
      const tabs = new Map(state.tabs)
      const tab = tabs.get(sessionId)
      if (tab?.ws) tab.ws.disconnect()
      tabs.delete(sessionId)
      const activeTabId =
        state.activeTabId === sessionId ? (tabs.keys().next().value ?? null) : state.activeTabId
      return { tabs, activeTabId }
    })
  },

  setActiveTab: (sessionId) => set({ activeTabId: sessionId }),

  renameTab: (sessionId, name) => {
    set((state) => {
      const tabs = new Map(state.tabs)
      const tab = tabs.get(sessionId)
      if (tab) tabs.set(sessionId, { ...tab, name })
      return { tabs }
    })
  },

  setWs: (sessionId, ws) => {
    set((state) => {
      const tabs = new Map(state.tabs)
      const tab = tabs.get(sessionId)
      if (tab) tabs.set(sessionId, { ...tab, ws })
      return { tabs }
    })
  },

  setConnected: (sessionId, connected) => {
    set((state) => {
      const tabs = new Map(state.tabs)
      const tab = tabs.get(sessionId)
      if (tab) tabs.set(sessionId, { ...tab, connected })
      return { tabs }
    })
  },

  updateScreen: (sessionId, ansi, meta) => {
    set((state) => {
      const tabs = new Map(state.tabs)
      const tab = tabs.get(sessionId)
      if (tab) tabs.set(sessionId, { ...tab, screenAnsi: ansi, meta })
      return { tabs }
    })
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get()
    return activeTabId ? (tabs.get(activeTabId) ?? null) : null
  },
}))
