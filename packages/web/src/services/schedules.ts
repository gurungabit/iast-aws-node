import { apiGet, apiPost, apiDelete } from './api'

export interface ScheduleDto {
  id: string
  astName: string
  scheduledTime: string
  status: string
  createdAt: string
}

export function getSchedules() {
  return apiGet<ScheduleDto[]>('/schedules')
}

export function createSchedule(data: {
  astName: string
  scheduledTime: string
  params?: Record<string, unknown>
  credentials?: { userId: string; password: string }
}) {
  return apiPost<ScheduleDto>('/schedules', data)
}

export function deleteSchedule(id: string) {
  return apiDelete(`/schedules/${id}`)
}
