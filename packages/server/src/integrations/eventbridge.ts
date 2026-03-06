import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
  type FlexibleTimeWindowMode,
} from '@aws-sdk/client-scheduler'

const client = new SchedulerClient({})

export interface ScheduleConfig {
  scheduleName: string
  scheduleExpression: string
  targetArn: string
  roleArn: string
  input: string
}

export async function createSchedule(config: ScheduleConfig): Promise<string> {
  const command = new CreateScheduleCommand({
    Name: config.scheduleName,
    ScheduleExpression: config.scheduleExpression,
    Target: {
      Arn: config.targetArn,
      RoleArn: config.roleArn,
      Input: config.input,
    },
    FlexibleTimeWindow: {
      Mode: 'OFF' as FlexibleTimeWindowMode,
    },
    ActionAfterCompletion: 'DELETE',
  })

  const response = await client.send(command)
  return response.ScheduleArn ?? config.scheduleName
}

export async function deleteSchedule(scheduleName: string): Promise<void> {
  const command = new DeleteScheduleCommand({
    Name: scheduleName,
  })
  await client.send(command)
}
