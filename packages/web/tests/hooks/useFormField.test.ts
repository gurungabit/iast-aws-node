import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockSetCustomField = vi.hoisted(() => vi.fn())
const mockState = vi.hoisted(() => ({
  current: {
    activeTabId: 'tab-1' as string | null,
    tabs: {
      'tab-1': { customFields: {} as Record<string, unknown> },
    } as Record<string, { customFields: Record<string, unknown> }>,
  },
}))

vi.mock('@src/stores/ast-store', () => ({
  useASTStore: (selector: (state: unknown) => unknown) => {
    return selector({
      activeTabId: mockState.current.activeTabId,
      tabs: mockState.current.tabs,
      setCustomField: mockSetCustomField,
    })
  },
}))

import { useFormField } from '@src/hooks/useFormField'

describe('useFormField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.current = {
      activeTabId: 'tab-1',
      tabs: { 'tab-1': { customFields: {} } },
    }
  })

  it('returns default value when no stored value', () => {
    const { result } = renderHook(() => useFormField('myKey', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('returns stored value when present', () => {
    mockState.current.tabs['tab-1'].customFields['myKey'] = 'stored'
    const { result } = renderHook(() => useFormField('myKey', 'default'))
    expect(result.current[0]).toBe('stored')
  })

  it('calls setCustomField when setValue is called', () => {
    const { result } = renderHook(() => useFormField('myKey', 'default'))
    act(() => {
      result.current[1]('newValue')
    })
    expect(mockSetCustomField).toHaveBeenCalledWith('tab-1', 'myKey', 'newValue')
  })

  it('returns default when no active tab', () => {
    mockState.current.activeTabId = null
    const { result } = renderHook(() => useFormField('myKey', 'fallback'))
    expect(result.current[0]).toBe('fallback')
  })
})
