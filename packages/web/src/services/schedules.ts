import { apiGet, apiPost, apiDelete } from './api'

export interface Schedule {
  id: string
  astName: string
  scheduledTime: string
  timezone: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt: string
  updatedAt: string
}

export interface CreateScheduleParams {
  astName: string
  scheduledTime: string
  timezone: string
  credentials: { username: string; password: string }
  params: Record<string, unknown>
  notifyEmail?: string
}

export interface CreateScheduleResult {
  scheduleId: string
}

export async function getSchedules(): Promise<Schedule[]> {
  return apiGet<Schedule[]>('/schedules')
}

export async function createSchedule(data: CreateScheduleParams): Promise<CreateScheduleResult> {
  return apiPost<CreateScheduleResult>('/schedules', data)
}

export async function cancelSchedule(id: string): Promise<void> {
  await apiDelete(`/schedules/${id}`)
}

export async function runScheduleNow(id: string): Promise<void> {
  await apiPost(`/schedules/${id}/run`)
}
