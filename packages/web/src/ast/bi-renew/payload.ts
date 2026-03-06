import type { CommonFormParams } from '../shared'
import { CATEGORY_AUTH_GROUP, type ASTCategory } from '../registry/types'
import { formatDateForBackend, getDefaultDate } from './types'

export function buildBiRenewPayload(args: {
  common: CommonFormParams
  userId: string
  category: ASTCategory
  configParams: Record<string, unknown>
}): Record<string, unknown> {
  const missedRunDate =
    typeof args.configParams.missedRunDate === 'string'
      ? args.configParams.missedRunDate
      : getDefaultDate()

  const payload: Record<string, unknown> = {
    username: args.common.username,
    password: args.common.password,
    userId: args.userId || 'anonymous',
    authGroup: CATEGORY_AUTH_GROUP[args.category],
    testMode: args.common.testMode,
  }

  if (missedRunDate) {
    payload.date = formatDateForBackend(missedRunDate)
  }

  if (args.common.parallel) {
    payload.parallel = true
  }

  return payload
}
