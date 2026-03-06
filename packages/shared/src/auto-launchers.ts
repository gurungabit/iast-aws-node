import type { ASTName, ASTParams, ASTStatus } from './ast.js'

export interface AutoLauncherStep {
  id: string
  astName: ASTName
  configId?: string
  params: ASTParams
  order: number
}

export interface AutoLauncher {
  id: string
  ownerId: string
  name: string
  visibility: 'private' | 'public'
  steps: AutoLauncherStep[]
  createdAt: Date
  updatedAt: Date
}

export type AutoLauncherRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface AutoLauncherRunStep {
  stepId: string
  astName: ASTName
  status: ASTStatus
  executionId?: string
  error?: string
}

export interface AutoLauncherRun {
  id: string
  launcherId: string
  userId: string
  sessionId: string
  status: AutoLauncherRunStatus
  steps: AutoLauncherRunStep[]
  currentStepIndex: number
  createdAt: Date
  completedAt?: Date
}
