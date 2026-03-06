import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockWrite = vi.hoisted(() => vi.fn())
const mockDispose = vi.hoisted(() => vi.fn())

vi.mock('@xterm/xterm', () => ({
  Terminal: function () {
    return {
      loadAddon: vi.fn(),
      open: vi.fn(),
      write: mockWrite,
      dispose: mockDispose,
      element: {
        clientWidth: 800,
        clientHeight: 400,
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
      },
    }
  },
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: function () {
    return { fit: vi.fn() }
  },
}))

vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

vi.mock('../config', () => ({
  config: {
    terminal: { rows: 43, cols: 80, fontSize: 14, fontFamily: 'monospace' },
  },
}))

const mockSend = vi.hoisted(() => vi.fn())
const mockOnMessage = vi.hoisted(() => vi.fn().mockReturnValue(vi.fn()))
const mockUpdateScreen = vi.hoisted(() => vi.fn())

vi.mock('../stores/session-store', () => ({
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
        setConnected: vi.fn(),
      })
    }
    return null
  }),
}))

import { TerminalComponent } from './Terminal'

describe('TerminalComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders terminal container', () => {
    const { container } = render(<TerminalComponent sessionId="s1" />)
    expect(container.querySelector('[tabindex="0"]')).toBeDefined()
  })

  it('shows connected status', () => {
    render(<TerminalComponent sessionId="s1" />)
    expect(screen.getByText('Connected')).toBeDefined()
  })

  it('shows cursor position', () => {
    render(<TerminalComponent sessionId="s1" />)
    expect(screen.getByText(/Cursor: \(1,1\)/)).toBeDefined()
  })

  it('sends enter key on Enter keydown', () => {
    const { container } = render(<TerminalComponent sessionId="s1" />)
    const termDiv = container.querySelector('[tabindex="0"]')!
    fireEvent.keyDown(termDiv, { key: 'Enter' })
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'enter' })
  })

  it('sends reset key on Escape', () => {
    const { container } = render(<TerminalComponent sessionId="s1" />)
    const termDiv = container.querySelector('[tabindex="0"]')!
    fireEvent.keyDown(termDiv, { key: 'Escape' })
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'reset' })
  })

  it('sends tab key on Tab', () => {
    const { container } = render(<TerminalComponent sessionId="s1" />)
    const termDiv = container.querySelector('[tabindex="0"]')!
    fireEvent.keyDown(termDiv, { key: 'Tab' })
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'keyTab' })
  })

  it('sends PF key on F1-F12', () => {
    const { container } = render(<TerminalComponent sessionId="s1" />)
    const termDiv = container.querySelector('[tabindex="0"]')!
    fireEvent.keyDown(termDiv, { key: 'F3' })
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'pf3' })
  })

  it('sends PF13-24 on Shift+F1-12', () => {
    const { container } = render(<TerminalComponent sessionId="s1" />)
    const termDiv = container.querySelector('[tabindex="0"]')!
    fireEvent.keyDown(termDiv, { key: 'F2', shiftKey: true })
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'pf14' })
  })

  it('sends pa1 on Ctrl+C', () => {
    const { container } = render(<TerminalComponent sessionId="s1" />)
    const termDiv = container.querySelector('[tabindex="0"]')!
    fireEvent.keyDown(termDiv, { key: 'c', ctrlKey: true })
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'pa1' })
  })

  it('sends reset on Ctrl+R', () => {
    const { container } = render(<TerminalComponent sessionId="s1" />)
    const termDiv = container.querySelector('[tabindex="0"]')!
    fireEvent.keyDown(termDiv, { key: 'r', ctrlKey: true })
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'reset' })
  })

  it('sends data for regular characters', () => {
    const { container } = render(<TerminalComponent sessionId="s1" />)
    const termDiv = container.querySelector('[tabindex="0"]')!
    fireEvent.keyDown(termDiv, { key: 'a' })
    expect(mockSend).toHaveBeenCalledWith({ type: 'data', text: 'a' })
  })

  it('does not send data for multi-char keys', () => {
    const { container } = render(<TerminalComponent sessionId="s1" />)
    const termDiv = container.querySelector('[tabindex="0"]')!
    fireEvent.keyDown(termDiv, { key: 'Shift' })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('ignores regular chars with ctrl/meta/alt modifiers', () => {
    const { container } = render(<TerminalComponent sessionId="s1" />)
    const termDiv = container.querySelector('[tabindex="0"]')!
    fireEvent.keyDown(termDiv, { key: 'a', metaKey: true })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('registers onMessage handler for screen updates', () => {
    render(<TerminalComponent sessionId="s1" />)
    expect(mockOnMessage).toHaveBeenCalled()

    // Call the registered handler with a screen message
    const handler = mockOnMessage.mock.calls[0][0]
    handler({ type: 'screen', ansi: 'test-ansi', meta: { cursorRow: 5, cursorCol: 10, locked: true } })

    expect(mockWrite).toHaveBeenCalledWith('test-ansi')
    expect(mockUpdateScreen).toHaveBeenCalledWith('s1', 'test-ansi', { cursorRow: 5, cursorCol: 10, locked: true })
  })

  it('ignores non-screen messages', () => {
    render(<TerminalComponent sessionId="s1" />)
    const handler = mockOnMessage.mock.calls[0][0]
    handler({ type: 'connected' })

    expect(mockWrite).not.toHaveBeenCalled()
  })

  it('handles click to set cursor position', () => {
    const { container } = render(<TerminalComponent sessionId="s1" />)
    const termDiv = container.querySelector('[tabindex="0"]')!

    // clientWidth=800, cols=80 → cellWidth=10
    // clientHeight=400, rows=43 → cellHeight≈9.3
    // click at (50, 20) → col = floor(50/10)+1 = 6, row = floor(20/9.3)+1 = 3
    fireEvent.click(termDiv, { clientX: 50, clientY: 20 })
    expect(mockSend).toHaveBeenCalledWith({ type: 'cursor', row: 3, col: 6 })
  })

  it('sends Backspace key', () => {
    const { container } = render(<TerminalComponent sessionId="s1" />)
    const termDiv = container.querySelector('[tabindex="0"]')!
    fireEvent.keyDown(termDiv, { key: 'Backspace' })
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'keyBackspace' })
  })

  it('sends arrow keys', () => {
    const { container } = render(<TerminalComponent sessionId="s1" />)
    const termDiv = container.querySelector('[tabindex="0"]')!
    fireEvent.keyDown(termDiv, { key: 'ArrowUp' })
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'keyCurUp' })
  })
})
