import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ChangeEvent } from 'react'
import { useFormField, useFormFields } from './useFormField'

function fakeChangeEvent(value: string): ChangeEvent<HTMLInputElement> {
  return { target: { value } } as ChangeEvent<HTMLInputElement>
}

describe('useFormField', () => {
  it('initializes with default empty string', () => {
    const { result } = renderHook(() => useFormField())
    expect(result.current.value).toBe('')
  })

  it('initializes with provided value', () => {
    const { result } = renderHook(() => useFormField('hello'))
    expect(result.current.value).toBe('hello')
  })

  it('updates value via onChange', () => {
    const { result } = renderHook(() => useFormField(''))
    act(() => {
      result.current.onChange(fakeChangeEvent('new value'))
    })
    expect(result.current.value).toBe('new value')
  })

  it('updates value via setValue', () => {
    const { result } = renderHook(() => useFormField(''))
    act(() => {
      result.current.setValue('direct set')
    })
    expect(result.current.value).toBe('direct set')
  })

  it('reset restores initial value', () => {
    const { result } = renderHook(() => useFormField('initial'))
    act(() => {
      result.current.onChange(fakeChangeEvent('modified'))
    })
    expect(result.current.value).toBe('modified')
    act(() => {
      result.current.reset()
    })
    expect(result.current.value).toBe('initial')
  })

  it('reset restores empty string when no initial provided', () => {
    const { result } = renderHook(() => useFormField())
    act(() => {
      result.current.setValue('something')
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.value).toBe('')
  })

  it('returns stable onChange reference', () => {
    const { result, rerender } = renderHook(() => useFormField(''))
    const first = result.current.onChange
    rerender()
    expect(result.current.onChange).toBe(first)
  })
})

describe('useFormFields', () => {
  const initial = { name: '', email: '', phone: '' }

  it('initializes with provided values', () => {
    const { result } = renderHook(() => useFormFields(initial))
    expect(result.current.values).toEqual({ name: '', email: '', phone: '' })
  })

  it('setField updates a specific field', () => {
    const { result } = renderHook(() => useFormFields(initial))
    act(() => {
      result.current.setField('name', 'Alice')
    })
    expect(result.current.values.name).toBe('Alice')
    expect(result.current.values.email).toBe('')
  })

  it('setField can update multiple fields independently', () => {
    const { result } = renderHook(() => useFormFields(initial))
    act(() => {
      result.current.setField('name', 'Bob')
      result.current.setField('email', 'bob@test.com')
    })
    expect(result.current.values.name).toBe('Bob')
    expect(result.current.values.email).toBe('bob@test.com')
    expect(result.current.values.phone).toBe('')
  })

  it('onChange returns a handler for a specific key', () => {
    const { result } = renderHook(() => useFormFields(initial))
    act(() => {
      const handler = result.current.onChange('email')
      handler(fakeChangeEvent('test@test.com'))
    })
    expect(result.current.values.email).toBe('test@test.com')
  })

  it('reset restores all fields to initial values', () => {
    const { result } = renderHook(() => useFormFields(initial))
    act(() => {
      result.current.setField('name', 'Changed')
      result.current.setField('email', 'changed@test.com')
      result.current.setField('phone', '555-1234')
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.values).toEqual(initial)
  })

  it('returns stable setField reference', () => {
    const { result, rerender } = renderHook(() => useFormFields(initial))
    const first = result.current.setField
    rerender()
    expect(result.current.setField).toBe(first)
  })

  it('returns stable onChange reference', () => {
    const { result, rerender } = renderHook(() => useFormFields(initial))
    const first = result.current.onChange
    rerender()
    expect(result.current.onChange).toBe(first)
  })

  it('works with pre-filled initial values', () => {
    const { result } = renderHook(() => useFormFields({ city: 'NYC', zip: '10001' }))
    expect(result.current.values.city).toBe('NYC')
    expect(result.current.values.zip).toBe('10001')
  })
})
