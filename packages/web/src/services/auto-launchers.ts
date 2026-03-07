import { apiGet, apiPost, apiPatch, apiDelete } from './api'

export interface AutoLauncherDto {
  id: string
  ownerId: string
  name: string
  visibility: string
  steps: unknown[]
  createdAt: string
  updatedAt: string
}

export interface AutoLauncherRunDto {
  id: string
  launcherId: string
  status: string
  steps: unknown[]
  currentStepIndex: string
  createdAt: string
  completedAt: string | null
}

export function getAutoLaunchers() {
  return apiGet<AutoLauncherDto[]>('/auto-launchers')
}

export function createAutoLauncher(data: { name: string; visibility?: string; steps?: unknown[] }) {
  return apiPost<AutoLauncherDto>('/auto-launchers', data)
}

export function updateAutoLauncher(
  id: string,
  data: { name?: string; visibility?: string; steps?: unknown[] },
) {
  return apiPatch<AutoLauncherDto>(`/auto-launchers/${id}`, data)
}

export function deleteAutoLauncher(id: string) {
  return apiDelete(`/auto-launchers/${id}`)
}

export interface RunAutoLauncherRequest {
  sessionId: string
  username: string
  password: string
  userLocalDate?: string
}

export interface RunAutoLauncherResponse {
  runId: string
  sessionId: string
  steps: Array<{
    astName: string
    configId: string
    order: number
    stepLabel?: string
    configName?: string
  }>
}

export function runAutoLauncher(launcherId: string, data: RunAutoLauncherRequest) {
  return apiPost<RunAutoLauncherResponse>(`/auto-launchers/${launcherId}/run`, data)
}

export function getAutoLauncherRuns(limit = 50, offset = 0) {
  return apiGet<AutoLauncherRunDto[]>(`/auto-launcher-runs?limit=${limit}&offset=${offset}`)
}
