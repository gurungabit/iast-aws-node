import { apiGet, apiPost, apiPatch, apiDelete } from './api'

export interface ASTConfigDto {
  id: string
  astName: string
  ownerId: string
  name: string
  visibility: string
  params: Record<string, unknown>
  tasks: unknown[]
  createdAt: string
  updatedAt: string
}

export function getASTConfigs(astName?: string) {
  const qs = astName ? `?astName=${astName}` : ''
  return apiGet<ASTConfigDto[]>(`/ast-configs${qs}`)
}

export function createASTConfig(data: {
  astName: string
  name: string
  visibility?: string
  params?: Record<string, unknown>
  tasks?: unknown[]
}) {
  return apiPost<ASTConfigDto>('/ast-configs', data)
}

export function updateASTConfig(
  id: string,
  data: { name?: string; visibility?: string; params?: Record<string, unknown>; tasks?: unknown[] },
) {
  return apiPatch<ASTConfigDto>(`/ast-configs/${id}`, data)
}

export function deleteASTConfig(id: string) {
  return apiDelete(`/ast-configs/${id}`)
}

export function cloneASTConfig(id: string, name: string) {
  return apiPost<ASTConfigDto>(`/ast-configs/${id}/clone`, { name })
}
