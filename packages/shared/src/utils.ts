import { randomBytes } from 'crypto'

export function generateSessionId(): string {
  return `ses_${randomBytes(4).toString('hex')}`
}

export function generateExecutionId(): string {
  return `exe_${randomBytes(6).toString('hex')}`
}

export function generateRunId(): string {
  return `run_${randomBytes(6).toString('hex')}`
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delayMs: number,
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < maxAttempts - 1) await sleep(delayMs)
    }
  }
  throw lastError
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}
