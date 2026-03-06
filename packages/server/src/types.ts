export type ASTName = 'login' | 'bi-renew' | 'rout-extractor'
export type ASTStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface ASTCredentials {
  userId: string
  password: string
}

export interface ASTTask {
  id: string
  label: string
  enabled: boolean
  params: Record<string, unknown>
}

export interface ASTItemResult {
  id: string
  policyNumber: string
  status: 'success' | 'failure' | 'skipped' | 'error'
  durationMs: number
  error?: string
  data?: Record<string, unknown>
}

export interface ASTProgress {
  current: number
  total: number
  message: string
}
