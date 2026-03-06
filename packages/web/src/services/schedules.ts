import { apiGet, apiPost, apiDelete } from './api'

export interface Schedule {
  id: string
  astName: string
  scheduledTime: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt: string
}

export interface CreateScheduleParams {
  astName: string
  scheduledTime: string
  credentials?: { userId: string; password: string }
  params?: Record<string, unknown>
}

export interface CreateScheduleResult {
  id: string
  astName: string
  scheduledTime: string
  status: string
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

