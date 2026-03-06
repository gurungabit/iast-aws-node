import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockAddTab = vi.hoisted(() => vi.fn())
const mockRemoveTab = vi.hoisted(() => vi.fn())
const mockSetActiveTab = vi.hoisted(() => vi.fn())
const mockSetWs = vi.hoisted(() => vi.fn())
const mockCreateSession = vi.hoisted(() => vi.fn())
const mockConnect = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('../stores/session-store', () => {
  const store = {
    tabs: new Map([
      ['tab1', { sessionId: 'tab1', name: 'Session 1', connected: true }],
    ]),
    activeTabId: 'tab1',
    addTab: mockAddTab,
    removeTab: mockRemoveTab,
    setActiveTab: mockSetActiveTab,
    setWs: mockSetWs,
  }
  return {
    useSessionStore: vi.fn((selector?: (state: unknown) => unknown) => {
      if (typeof selector === 'function') return selector(store)
      return store
    }),
  }
})

vi.mock('../services/sessions', () => ({
  createSession: mockCreateSession,
}))

vi.mock('../services/websocket', () => ({
  TerminalWebSocket: function () {
    return { connect: mockConnect }
  },
}))

vi.mock('../utils', () => ({
  cn: (...args: (string | false | undefined | null)[]) => args.filter(Boolean).join(' '),
}))

import { SessionSelector } from './SessionSelector'

describe('SessionSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSession.mockResolvedValue({ id: 'new-session', name: 'New Session' })
  })

  it('renders tab buttons', () => {
    render(<SessionSelector />)
    expect(screen.getByText('Session 1')).toBeDefined()
  })

  it('renders + button', () => {
    render(<SessionSelector />)
    expect(screen.getByText('+')).toBeDefined()
  })

  it('creates new session on + click', async () => {
    render(<SessionSelector />)
    fireEvent.click(screen.getByText('+'))
    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled()
    })
  })

  it('calls setActiveTab when tab clicked', () => {
    render(<SessionSelector />)
    fireEvent.click(screen.getByText('Session 1'))
    expect(mockSetActiveTab).toHaveBeenCalledWith('tab1')
  })

  it('shows connected indicator', () => {
    const { container } = render(<SessionSelector />)
    const dot = container.querySelector('.bg-green-400')
    expect(dot).toBeDefined()
  })

  it('handles close button click', () => {
    render(<SessionSelector />)
    // The close button is the × span inside each tab
    const closeBtn = screen.getByText('×')
    fireEvent.click(closeBtn)
    expect(mockRemoveTab).toHaveBeenCalledWith('tab1')
  })

  it('handles session creation failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreateSession.mockRejectedValueOnce(new Error('Network error'))
    render(<SessionSelector />)
    fireEvent.click(screen.getByText('+'))
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to create session:', expect.any(Error))
    })
    consoleSpy.mockRestore()
  })

  it('connects websocket and sets ws after creating session', async () => {
    render(<SessionSelector />)
    fireEvent.click(screen.getByText('+'))
    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled()
      expect(mockSetWs).toHaveBeenCalledWith('new-session', expect.anything())
      expect(mockAddTab).toHaveBeenCalledWith('new-session', 'New Session')
    })
  })
})
