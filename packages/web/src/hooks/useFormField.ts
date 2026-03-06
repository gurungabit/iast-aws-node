import { useState, useCallback, type ChangeEvent } from 'react'

export function useFormField(initialValue = '') {
  const [value, setValue] = useState(initialValue)

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setValue(e.target.value)
  }, [])

  const reset = useCallback(() => setValue(initialValue), [initialValue])

  return { value, setValue, onChange, reset }
}

export function useFormFields<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState(initial)

  const setField = useCallback((key: keyof T, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const onChange = useCallback(
    (key: keyof T) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setField(key, e.target.value)
    },
    [setField],
  )

  const reset = useCallback(() => setValues(initial), [initial])

  return { values, setField, onChange, reset }
}
