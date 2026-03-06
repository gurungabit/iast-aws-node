export function isValidPolicyNumber(value: string): boolean {
  return /^[A-Za-z0-9]{9}$/.test(value)
}

export function parsePolicyNumbers(input: string): string[] {
  if (!input.trim()) return []
  return input
    .split(/[,\s\n]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => isValidPolicyNumber(s))
}
