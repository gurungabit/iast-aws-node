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

export function getAutoLauncherRuns(limit = 50, offset = 0) {
  return apiGet<AutoLauncherRunDto[]>(`/auto-launcher-runs?limit=${limit}&offset=${offset}`)
}
