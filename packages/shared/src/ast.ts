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

export interface ASTParams {
  credentials: ASTCredentials
  host?: string
  region?: string
  tasks?: ASTTask[]
  [key: string]: unknown
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

export interface ASTConfig {
  id: string
  astName: ASTName
  ownerId: string
  name: string
  visibility: 'private' | 'public'
  params: ASTParams
  tasks: ASTTask[]
  createdAt: Date
  updatedAt: Date
}

export interface Execution {
  id: string
  sessionId: string
  userId: string
  astName: ASTName
  status: ASTStatus
  hostUser?: string
  runId?: string
  executionDate: string
  startedAt: Date
  completedAt?: Date
  totalPolicies: number
  successCount: number
  failureCount: number
  errorCount: number
}
