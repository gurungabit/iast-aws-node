import { apiGet, apiPost, apiPatch, apiDelete } from './api'

export interface SessionDto {
  id: string
  name: string
  createdAt: string
}

export function getSessions() {
  return apiGet<SessionDto[]>('/sessions')
}

export function createSession(name?: string) {
  return apiPost<SessionDto>('/sessions', { name })
}

export function renameSession(id: string, name: string) {
  return apiPatch<SessionDto>(`/sessions/${id}`, { name })
}

export function deleteSession(id: string) {
  return apiDelete(`/sessions/${id}`)
}
