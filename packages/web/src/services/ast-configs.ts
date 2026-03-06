import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type { SavedAstConfigWithAccess } from '../ast/types'

export type AstConfigListScope = 'mine' | 'public' | 'all'

// Server returns { id, name, ... } but frontend uses { configId, configurationName, ... }
interface ServerAstConfig {
  id: string
  astName: string
  ownerId: string
  name: string
  visibility: string
  params: Record<string, unknown>
  tasks?: unknown[]
  createdAt: string
  updatedAt: string
}

function mapServerConfig(s: ServerAstConfig): SavedAstConfigWithAccess {
  return {
    configId: s.id,
    astName: s.astName,
    configurationName: s.name,
    oc: (s.params?.oc as string) ?? '',
    visibility: s.visibility as 'private' | 'public',
    parallel: (s.params?.parallel as boolean) ?? false,
    testMode: (s.params?.testMode as boolean) ?? false,
    multiTask: (s.params?.multiTask as boolean) ?? false,
    tasks: (s.tasks ?? []) as SavedAstConfigWithAccess['tasks'],
    params: s.params ?? {},
    ownerAlias: s.ownerId,
    isOwner: true,
    canEdit: true,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }
}

export async function listAstConfigs(
  astName?: string,
  _scope: AstConfigListScope = 'all',
): Promise<SavedAstConfigWithAccess[]> {
  const query = astName ? `?astName=${astName}` : ''
  const results = await apiGet<ServerAstConfig[]>(`/ast-configs${query}`)
  return results.map(mapServerConfig)
}

export async function getAstConfig(configId: string): Promise<SavedAstConfigWithAccess> {
  const result = await apiGet<ServerAstConfig>(`/ast-configs/${configId}`)
  return mapServerConfig(result)
}

export async function createAstConfig(data: {
  astName: string
  configurationName: string
  visibility?: string
  oc?: string
  parallel?: boolean
  testMode?: boolean
  params?: Record<string, unknown>
  tasks?: unknown[]
}): Promise<SavedAstConfigWithAccess> {
  const params = {
    ...data.params,
    oc: data.oc,
    parallel: data.parallel,
    testMode: data.testMode,
  }
  const result = await apiPost<ServerAstConfig>('/ast-configs', {
    astName: data.astName,
    name: data.configurationName,
    visibility: data.visibility,
    params,
    tasks: data.tasks,
  })
  return mapServerConfig(result)
}

export async function updateAstConfig(
  _astName: string,
  configId: string,
  data: {
    configurationName?: string
    visibility?: string
    oc?: string
    parallel?: boolean
    testMode?: boolean
    params?: Record<string, unknown>
    tasks?: unknown[]
  },
): Promise<SavedAstConfigWithAccess> {
  const params = data.params !== undefined || data.oc !== undefined || data.parallel !== undefined || data.testMode !== undefined
    ? { ...data.params, oc: data.oc, parallel: data.parallel, testMode: data.testMode }
    : undefined
  const result = await apiPatch<ServerAstConfig>(`/ast-configs/${configId}`, {
    name: data.configurationName,
    visibility: data.visibility,
    params,
    tasks: data.tasks,
  })
  return mapServerConfig(result)
}

export async function cloneAstConfig(
  _astName: string,
  configId: string,
  data: { configurationName: string },
): Promise<SavedAstConfigWithAccess> {
  const result = await apiPost<ServerAstConfig>(`/ast-configs/${configId}/clone`, {
    name: data.configurationName,
  })
  return mapServerConfig(result)
}

export async function deleteAstConfig(_astName: string, configId: string): Promise<void> {
  await apiDelete(`/ast-configs/${configId}`)
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
  _astName: string,
  configId: string,
  data: {
    username: string
    password: string
    sessionId: string
    userLocalDate: string
  },
): Promise<RunAstConfigResult> {
  return apiPost<RunAstConfigResult>(`/ast-configs/${configId}/run`, data)
}
