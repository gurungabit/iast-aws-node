import { useCallback, type ChangeEvent } from 'react'
import { useASTStore } from '../stores/ast-store'

/**
 * Persist a form field value per-tab in the AST store's customFields.
 * Returns [value, setValue] similar to useState.
 */
export function useFormField<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const activeTabId = useASTStore((s) => s.activeTabId)
  const storedValue = useASTStore((s) => {
    if (!activeTabId) return undefined
    return s.tabs[activeTabId]?.customFields[key]
  })
  const setCustomField = useASTStore((s) => s.setCustomField)

  const value = storedValue !== undefined ? (storedValue as T) : defaultValue

  const setValue = useCallback(
    (newValue: T) => {
      if (activeTabId) {
        setCustomField(activeTabId, key, newValue)
      }
    },
    [activeTabId, key, setCustomField],
  )

  return [value, setValue]
}

/**
 * Simple form field hook (non-persisted) for basic inputs.
 */
export function useSimpleFormField(initialValue = '') {
  const [value, setValue] = useFormField<string>('_simple_' + initialValue, initialValue)

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValue(e.target.value)
    },
    [setValue],
  )

  const reset = useCallback(() => setValue(initialValue), [initialValue, setValue])

  return { value, setValue, onChange, reset }
}
