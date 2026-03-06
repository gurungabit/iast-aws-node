import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockSend = vi.hoisted(() => vi.fn())
const mockOnMessage = vi.hoisted(() => vi.fn().mockReturnValue(vi.fn()))
const mockConnect = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockDisconnect = vi.hoisted(() => vi.fn())

vi.mock('@xterm/xterm', () => ({
  Terminal: function () {
    return {
      open: vi.fn(),
      write: vi.fn(),
      dispose: vi.fn(),
    }
  },
}))

vi.mock('@src/config', () => ({
  config: {
    terminal: { rows: 43, cols: 80, fontSize: 14, fontFamily: 'monospace' },
    api: { baseUrl: '' },
    ws: { baseUrl: '' },
  },
}))

const mockSetWs = vi.hoisted(() => vi.fn())
const mockSetConnected = vi.hoisted(() => vi.fn())
const mockUpdateScreen = vi.hoisted(() => vi.fn())
const mockGetState = vi.hoisted(() => vi.fn())

vi.mock('@src/stores/session-store', () => ({
  useSessionStore: Object.assign(
    vi.fn((selector: (state: Record<string, unknown>) => unknown) => {
      if (typeof selector === 'function') {
        return selector({
          setWs: mockSetWs,
          setConnected: mockSetConnected,
          updateScreen: mockUpdateScreen,
        })
      }
      return { setWs: mockSetWs, setConnected: mockSetConnected, updateScreen: mockUpdateScreen }
    }),
    { getState: mockGetState },
  ),
}))

vi.mock('@src/services/websocket', () => ({
  TerminalWebSocket: function () {
    return {
      send: mockSend,
      connect: mockConnect,
      disconnect: mockDisconnect,
      onMessage: mockOnMessage,
    }
  },
}))

import { useTerminal } from '@src/hooks/useTerminal'

describe('useTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({
      tabs: new Map([
        ['s1', { ws: { send: mockSend } }],
      ]),
    })
  })

  it('sendKey sends key message', () => {
    const { result } = renderHook(() => useTerminal('s1'))
    act(() => {
      result.current.sendKey('enter')
    })
    expect(mockSend).toHaveBeenCalledWith({ type: 'key', key: 'enter' })
  })

  it('sendKey does nothing when sessionId is null', () => {
    const { result } = renderHook(() => useTerminal(null))
    act(() => {
      result.current.sendKey('enter')
    })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sendData sends data message', () => {
    const { result } = renderHook(() => useTerminal('s1'))
    act(() => {
      result.current.sendData('hello')
    })
    expect(mockSend).toHaveBeenCalledWith({ type: 'data', text: 'hello' })
  })

  it('connectToHost sends connect message', () => {
    const { result } = renderHook(() => useTerminal('s1'))
    act(() => {
      result.current.connectToHost('myhost', 3270)
    })
    expect(mockSend).toHaveBeenCalledWith({ type: 'connect', host: 'myhost', port: 3270, options: undefined })
  })

  it('disconnectFromHost sends disconnect message', () => {
    const { result } = renderHook(() => useTerminal('s1'))
    act(() => {
      result.current.disconnectFromHost()
    })
    expect(mockSend).toHaveBeenCalledWith({ type: 'disconnect' })
  })

  it('disconnectFromHost does nothing when sessionId is null', () => {
    const { result } = renderHook(() => useTerminal(null))
    act(() => {
      result.current.disconnectFromHost()
    })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('returns attach function', () => {
    const { result } = renderHook(() => useTerminal('s1'))
    expect(typeof result.current.attach).toBe('function')
  })

  it('attach does nothing when container is null', () => {
    const { result } = renderHook(() => useTerminal('s1'))
    act(() => {
      result.current.attach(null)
    })
    expect(mockSetWs).not.toHaveBeenCalled()
  })

  it('attach does nothing when sessionId is null', () => {
    const { result } = renderHook(() => useTerminal(null))
    const container = document.createElement('div')
    act(() => {
      result.current.attach(container)
    })
    expect(mockSetWs).not.toHaveBeenCalled()
  })

  it('attach creates terminal and websocket when given container and sessionId', () => {
    const { result } = renderHook(() => useTerminal('s1'))
    const container = document.createElement('div')
    act(() => {
      result.current.attach(container)
    })
    expect(mockSetWs).toHaveBeenCalledWith('s1', expect.anything())
    expect(mockOnMessage).toHaveBeenCalled()
  })

  it('attach returns cleanup function', () => {
    const { result } = renderHook(() => useTerminal('s1'))
    const container = document.createElement('div')
    let cleanup: (() => void) | undefined
    act(() => {
      cleanup = result.current.attach(container) as (() => void) | undefined
    })
    expect(typeof cleanup).toBe('function')
  })

  it('attach disposes previous terminal', () => {
    const { result } = renderHook(() => useTerminal('s1'))
    const container = document.createElement('div')
    act(() => {
      result.current.attach(container)
    })
    // Call attach again to trigger dispose of previous terminal
    act(() => {
      result.current.attach(container)
    })
    // Should have been called twice (two TerminalWebSocket instances)
    expect(mockSetWs).toHaveBeenCalledTimes(2)
  })

  it('connectToHost does nothing when sessionId is null', () => {
    const { result } = renderHook(() => useTerminal(null))
    act(() => {
      result.current.connectToHost('host', 3270)
    })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sendData does nothing when sessionId is null', () => {
    const { result } = renderHook(() => useTerminal(null))
    act(() => {
      result.current.sendData('hello')
    })
    expect(mockSend).not.toHaveBeenCalled()
  })
})
