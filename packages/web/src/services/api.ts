import { config } from '../config'
import { getAccessToken } from '../auth/token'

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  const response = await fetch(`${config.apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error?.message || `HTTP ${response.status}`)
  }

  return response
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await authFetch(path)
  return res.json()
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await authFetch(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  return res.json()
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function apiDelete(path: string): Promise<void> {
  const token = await getAccessToken()
  const response = await fetch(`${config.apiUrl}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok && response.status !== 204) {
    throw new Error(`HTTP ${response.status}`)
  }
}
