export function formatDateForBackend(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${month}/${day}/${year}`
}

export function getDefaultDate(): string {
  return ''
}
