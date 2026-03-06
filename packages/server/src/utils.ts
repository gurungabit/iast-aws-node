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

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}
