import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockWrite = vi.hoisted(() => vi.fn())
const mockDispose = vi.hoisted(() => vi.fn())
const mockFocus = vi.hoisted(() => vi.fn())

let capturedOnKeyHandler: ((ev: { domEvent: KeyboardEvent }) => void) | null = null
let capturedCustomKeyHandler: ((ev: KeyboardEvent) => boolean) | null = null

vi.mock('@xterm/xterm', () => ({
  Terminal: function () {
    return {
      open: vi.fn(),
      write: mockWrite,
      dispose: mockDispose,
      focus: mockFocus,
      element: document.createElement('div'),
      onKey: vi.fn((handler: (ev: { domEvent: KeyboardEvent }) => void) => {
        capturedOnKeyHandler = handler
      }),
      attachCustomKeyEventHandler: vi.fn((handler: (ev: KeyboardEvent) => boolean) => {
        capturedCustomKeyHandler = handler
      }),
    }
  },
}))

vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

vi.mock('@src/config', () => ({
  config: {
    terminal: { rows: 43, cols: 80, fontSize: 14, fontFamily: 'monospace' },
  },
}))

const mockSend = vi.hoisted(() => vi.fn())
const mockOnMessage = vi.hoisted(() => vi.fn().mockReturnValue(vi.fn()))
const mockUpdateScreen = vi.hoisted(() => vi.fn())
const mockSetConnected = vi.hoisted(() => vi.fn())

vi.mock('@src/stores/session-store', () => ({
  useSessionStore: vi.fn((selector: (state: unknown) => unknown) => {
    if (typeof selector === 'function') {
      return selector({
        tabs: new Map([
          ['s1', {
            sessionId: 's1',
            connected: true,
            ws: { send: mockSend, onMessage: mockOnMessage },
            meta: { cursorRow: 1, cursorCol: 1, locked: false },
          }],
        ]),
        updateScreen: mockUpdateScreen,
        setConnected: mockSetConnected,
      })
    }
    return null
  }),
}))

import { TerminalComponent } from '@src/terminal/Terminal'

function simulateKey(key: string, opts: Partial<KeyboardEvent> = {}) {
  const ev = new KeyboardEvent('keydown', { key, ...opts })
  capturedOnKeyHandler?.({ domEvent: ev })
}

describe('TerminalComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    capturedOnKeyHandler = null
    capturedCustomKeyHandler = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders status bar and terminal container', () => {
    render(<TerminalComponent sessionId="s1" />)
    expect(screen.getByText('Connected')).toBeDefined()
  })

  it('shows cursor position', () => {
    render(<TerminalComponent sessionId="s1" />)
    expect(screen.getByText(/Cursor: \(1,1\)/)).toBeDefined()
  })

  it('sends connect on mount', () => {
    render(<TerminalComponent sessionId="s1" />)
    expect(mockSend).toHaveBeenCalledWith({ type: 'connect' })
  })

  it('registers onMessage handler', () => {
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    expect(mockOnMessage).toHaveBeenCalled()
  })

  it('handles screen message via onMessage', () => {
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    const handler = mockOnMessage.mock.calls[0][0]
    handler({ type: 'screen', ansi: 'test-ansi', meta: { cursorRow: 5, cursorCol: 10, locked: true } })
    expect(mockWrite).toHaveBeenCalledWith('test-ansi')
    expect(mockUpdateScreen).toHaveBeenCalledWith('s1', 'test-ansi', { cursorRow: 5, cursorCol: 10, locked: true })
  })

  it('handles connected message', () => {
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    const handler = mockOnMessage.mock.calls[0][0]
    handler({ type: 'connected' })
    expect(mockSetConnected).toHaveBeenCalledWith('s1', true)
  })

  it('sends enter key via onKey handler', () => {
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    simulateKey('Enter')
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'enter' })
  })

  it('sends escape as reset via onKey handler', () => {
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    simulateKey('Escape')
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'reset' })
  })

  it('sends tab key', () => {
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    simulateKey('Tab')
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'keyTab' })
  })

  it('sends PF key on F-keys', () => {
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    simulateKey('F3')
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'pf3' })
  })

  it('sends pa1 on Ctrl+C via onKey', () => {
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    simulateKey('c', { ctrlKey: true })
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'pa1' })
  })

  it('sends reset on Ctrl+R', () => {
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    simulateKey('r', { ctrlKey: true })
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'reset' })
  })

  it('sends data for regular characters', () => {
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    simulateKey('a')
    expect(mockSend).toHaveBeenCalledWith({ type: 'data', text: 'a' })
  })

  it('sends Backspace key', () => {
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    simulateKey('Backspace')
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'keyBackspace' })
  })

  it('sends arrow keys', () => {
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    simulateKey('ArrowUp')
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'keyCurUp' })
  })

  it('does not send data for modifier-only keys', () => {
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    simulateKey('Shift')
    // Shift is a multi-char key name, so it shouldn't be sent as data
    // and it doesn't match any special key handler
    expect(mockSend).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'data' }))
  })

  it('Ctrl+V is intercepted by customKeyEventHandler', () => {
    // Mock clipboard API for jsdom
    Object.assign(navigator, {
      clipboard: { readText: vi.fn().mockResolvedValue('pasted text') },
    })
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    expect(capturedCustomKeyHandler).toBeDefined()
    const ev = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })
    const result = capturedCustomKeyHandler!(ev)
    // Returns false to prevent xterm from processing it (browser handles paste)
    expect(result).toBe(false)
  })

  it('Ctrl+C is intercepted by customKeyEventHandler for copy', () => {
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    const ev = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })
    const result = capturedCustomKeyHandler!(ev)
    expect(result).toBe(false)
  })

  it('regular keys pass through customKeyEventHandler', () => {
    render(<TerminalComponent sessionId="s1" />)
    vi.advanceTimersByTime(200)
    const ev = new KeyboardEvent('keydown', { key: 'a' })
    const result = capturedCustomKeyHandler!(ev)
    expect(result).toBe(true)
  })
})
