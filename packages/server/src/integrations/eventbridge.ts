// AWS EventBridge Scheduler for scheduled AST runs
// TODO: Implement when schedule routes are fully wired

export interface ScheduleConfig {
  scheduleName: string
  scheduleExpression: string
  targetArn: string
  roleArn: string
  input: string
}

export async function createSchedule(_config: ScheduleConfig): Promise<string> {
  // TODO: Use @aws-sdk/client-scheduler
  throw new Error('EventBridge integration not yet implemented')
}

export async function deleteSchedule(_scheduleName: string): Promise<void> {
  throw new Error('EventBridge integration not yet implemented')
}
