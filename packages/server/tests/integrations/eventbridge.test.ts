import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const send = vi.fn()
  return {
    send,
    SchedulerClient: vi.fn().mockImplementation(function () {
      return { send }
    }),
    CreateScheduleCommand: vi.fn().mockImplementation(function (this: Record<string, unknown>, input: Record<string, unknown>) {
      this.__type = 'CreateScheduleCommand'
      this.input = input
    }),
    DeleteScheduleCommand: vi.fn().mockImplementation(function (this: Record<string, unknown>, input: Record<string, unknown>) {
      this.__type = 'DeleteScheduleCommand'
      this.input = input
    }),
  }
})

vi.mock('@aws-sdk/client-scheduler', () => ({
  SchedulerClient: mocks.SchedulerClient,
  CreateScheduleCommand: mocks.CreateScheduleCommand,
  DeleteScheduleCommand: mocks.DeleteScheduleCommand,
}))

import { createSchedule, deleteSchedule, type ScheduleConfig } from '@src/integrations/eventbridge.js'

describe('createSchedule', () => {
  const testConfig: ScheduleConfig = {
    scheduleName: 'test-schedule',
    scheduleExpression: 'rate(1 hour)',
    targetArn: 'arn:aws:lambda:us-east-1:123456789:function:myFunc',
    roleArn: 'arn:aws:iam::123456789:role/scheduler-role',
    input: '{"key": "value"}',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.send.mockResolvedValue({ ScheduleArn: 'arn:aws:scheduler:us-east-1:123:schedule/test' })
  })

  it('should create a schedule with correct command params', async () => {
    await createSchedule(testConfig)

    expect(mocks.CreateScheduleCommand).toHaveBeenCalledWith({
      Name: 'test-schedule',
      ScheduleExpression: 'rate(1 hour)',
      Target: {
        Arn: 'arn:aws:lambda:us-east-1:123456789:function:myFunc',
        RoleArn: 'arn:aws:iam::123456789:role/scheduler-role',
        Input: '{"key": "value"}',
      },
      FlexibleTimeWindow: {
        Mode: 'OFF',
      },
      ActionAfterCompletion: 'DELETE',
    })
  })

  it('should send the command via the SchedulerClient', async () => {
    await createSchedule(testConfig)
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  it('should return the ScheduleArn from the response', async () => {
    mocks.send.mockResolvedValue({ ScheduleArn: 'arn:aws:scheduler:us-east-1:123:schedule/my-sched' })

    const result = await createSchedule(testConfig)
    expect(result).toBe('arn:aws:scheduler:us-east-1:123:schedule/my-sched')
  })

  it('should fall back to scheduleName when ScheduleArn is undefined', async () => {
    mocks.send.mockResolvedValue({ ScheduleArn: undefined })

    const result = await createSchedule(testConfig)
    expect(result).toBe('test-schedule')
  })

  it('should fall back to scheduleName when ScheduleArn is null', async () => {
    mocks.send.mockResolvedValue({ ScheduleArn: null })

    const result = await createSchedule(testConfig)
    expect(result).toBe('test-schedule')
  })

  it('should propagate errors from client.send', async () => {
    mocks.send.mockRejectedValue(new Error('ThrottlingException'))

    await expect(createSchedule(testConfig)).rejects.toThrow('ThrottlingException')
  })

  it('should set ActionAfterCompletion to DELETE', async () => {
    await createSchedule(testConfig)

    expect(mocks.CreateScheduleCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        ActionAfterCompletion: 'DELETE',
      }),
    )
  })

  it('should set FlexibleTimeWindow mode to OFF', async () => {
    await createSchedule(testConfig)

    expect(mocks.CreateScheduleCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        FlexibleTimeWindow: { Mode: 'OFF' },
      }),
    )
  })
})

describe('deleteSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.send.mockResolvedValue({})
  })

  it('should create DeleteScheduleCommand with correct name', async () => {
    await deleteSchedule('my-schedule-to-delete')

    expect(mocks.DeleteScheduleCommand).toHaveBeenCalledWith({
      Name: 'my-schedule-to-delete',
    })
  })

  it('should send the delete command via the client', async () => {
    await deleteSchedule('sched-name')
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  it('should propagate errors from delete', async () => {
    mocks.send.mockRejectedValue(new Error('ResourceNotFoundException'))

    await expect(deleteSchedule('nonexistent')).rejects.toThrow('ResourceNotFoundException')
  })

  it('should resolve without returning a value', async () => {
    const result = await deleteSchedule('sched')
    expect(result).toBeUndefined()
  })
})
