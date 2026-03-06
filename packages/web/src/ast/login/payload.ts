import type { CommonFormParams } from '../shared'
import { CATEGORY_AUTH_GROUP, type ASTCategory } from '../registry/types'
import { parsePolicyNumbers } from './types'

export function buildLoginPayload(args: {
  common: CommonFormParams
  userId: string
  category: ASTCategory
  configParams: Record<string, unknown>
}): Record<string, unknown> {
  const policyInput =
    typeof args.configParams.policyInput === 'string' ? args.configParams.policyInput : ''

  const payload: Record<string, unknown> = {
    username: args.common.username,
    password: args.common.password,
    userId: args.userId || 'anonymous',
    authGroup: CATEGORY_AUTH_GROUP[args.category],
    testMode: args.common.testMode,
  }

  const policies = parsePolicyNumbers(policyInput)
  if (policies.length > 0) {
    payload.policyNumbers = policies
  }

  if (args.common.parallel) {
    payload.parallel = true
  }

  return payload
}
