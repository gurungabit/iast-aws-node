// Shared AST types used across the web app

export type ASTStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface ASTResult {
  status: ASTStatus
  message?: string
  error?: string
  duration?: number
  data?: Record<string, unknown>
}

export interface ASTProgress {
  current: number
  total: number
  percentage: number
  message?: string
  currentItem?: string
  itemStatus?: 'success' | 'failed'
}

export interface ASTItemResult {
  id: string
  policyNumber: string
  status: 'success' | 'failure' | 'skipped' | 'error'
  durationMs: number
  error?: string
  data?: Record<string, unknown>
}

// AST Config types

export interface AstConfigTask {
  taskId: string
  order: number
  description: string
  params: Record<string, unknown>
}

export type AstConfigVisibility = 'private' | 'public'

export interface SavedAstConfigWithAccess {
  configId: string
  astName: string
  configurationName: string
  oc: string
  visibility: AstConfigVisibility
  parallel: boolean
  testMode: boolean
  multiTask?: boolean
  tasks?: AstConfigTask[]
  params: Record<string, unknown>
  ownerAlias: string
  isOwner: boolean
  canEdit: boolean
  createdAt: string
  updatedAt: string
}

export interface BaseASTPayload {
  username: string
  password: string
  testMode?: boolean
  parallel?: boolean
  authGroup?: string
  userId?: string
}

// Helpers

export function extractAlias(email: string): string {
  if (!email) return ''
  const localPart = email.split('@')[0]
  const segments = localPart.split('.')
  return segments[segments.length - 1]
}

export function getLocalDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
