export const ErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SESSION_LIMIT: 'SESSION_LIMIT',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  TERMINAL_ERROR: 'TERMINAL_ERROR',
  AST_ERROR: 'AST_ERROR',
  AST_CANCELLED: 'AST_CANCELLED',
  DB_ERROR: 'DB_ERROR',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: ErrorCode
    message: string
    details?: unknown
  }
}

export function apiSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

export function apiError(code: ErrorCode, message: string, details?: unknown): ApiResponse {
  return { success: false, error: { code, message, details } }
}
