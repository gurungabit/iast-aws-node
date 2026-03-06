import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type { SavedAstConfigWithAccess } from '../ast/types'

export type AstConfigListScope = 'mine' | 'public' | 'all'

export async function listAstConfigs(
  astName: string,
  scope: AstConfigListScope = 'all',
): Promise<SavedAstConfigWithAccess[]> {
  return apiGet<SavedAstConfigWithAccess[]>(`/ast-configs?astName=${astName}&scope=${scope}`)
}

export async function getAstConfig(
  astName: string,
  configId: string,
): Promise<SavedAstConfigWithAccess> {
  return apiGet<SavedAstConfigWithAccess>(`/ast-configs/${astName}/${configId}`)
}

export async function createAstConfig(data: {
  astName: string
  category: string
  configurationName: string
  oc: string
  parallel: boolean
  testMode: boolean
  visibility: string
  params: Record<string, unknown>
  multiTask?: boolean
  tasks?: unknown[]
}): Promise<SavedAstConfigWithAccess> {
  return apiPost<SavedAstConfigWithAccess>('/ast-configs', data)
}

export async function updateAstConfig(
  astName: string,
  configId: string,
  data: {
    configurationName?: string
    oc?: string
    parallel?: boolean
    testMode?: boolean
    visibility?: string
    params?: Record<string, unknown>
    multiTask?: boolean
    tasks?: unknown[]
  },
): Promise<SavedAstConfigWithAccess> {
  return apiPatch<SavedAstConfigWithAccess>(`/ast-configs/${astName}/${configId}`, data)
}

export async function cloneAstConfig(
  astName: string,
  configId: string,
  data: { configurationName: string },
): Promise<SavedAstConfigWithAccess> {
  return apiPost<SavedAstConfigWithAccess>(`/ast-configs/${astName}/${configId}/clone`, data)
}

export async function deleteAstConfig(astName: string, configId: string): Promise<void> {
  await apiDelete(`/ast-configs/${astName}/${configId}`)
}

export interface RunAstConfigResult {
  runId: string
  taskCount: number
  steps?: Array<{
    astName: string
    configId: string
    order: number
    stepLabel?: string
    taskLabel?: string | null
    configName?: string
  }>
}

export async function runAstConfig(
  astName: string,
  configId: string,
  data: {
    username: string
    password: string
    sessionId: string
    userLocalDate: string
  },
): Promise<RunAstConfigResult> {
  return apiPost<RunAstConfigResult>(`/ast-configs/${astName}/${configId}/run`, data)
}
