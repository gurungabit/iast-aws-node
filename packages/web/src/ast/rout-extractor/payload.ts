import type { CommonFormParams } from '../shared'
import { CATEGORY_AUTH_GROUP, type ASTCategory } from '../registry/types'
import { getDefaultConfigParams } from './types'

export function buildRoutExtractorPayload(args: {
  common: CommonFormParams
  userId: string
  category: ASTCategory
  configParams: Record<string, unknown>
}): Record<string, unknown> {
  const defaults = getDefaultConfigParams()
  const p = { ...defaults, ...args.configParams }

  const payload: Record<string, unknown> = {
    username: args.common.username,
    password: args.common.password,
    userId: args.userId || 'anonymous',
    authGroup: CATEGORY_AUTH_GROUP[args.category],
    testMode: args.common.testMode,
    sourceMode: p.sourceMode,
    sections: Array.isArray(p.sections) ? p.sections : defaults.sections,
    statusActive: Boolean(p.statusActive),
    statusPended: Boolean(p.statusPended),
    statusOther: Boolean(p.statusOther),
    unitExclusions: typeof p.unitExclusions === 'string' ? p.unitExclusions : '',
    navigationMethod: p.navigationMethod ?? 'occ',
    navigateAllOccs: Boolean(p.navigateAllOccs),
    startOcc: typeof p.startOcc === 'number' ? p.startOcc : 1,
    endOcc: typeof p.endOcc === 'number' ? p.endOcc : 11,
    supvIds: typeof p.supvIds === 'string' ? p.supvIds : '',
    updateRouteItems: Boolean(p.updateRouteItems),
    file412Path: typeof p.file412Path === 'string' ? p.file412Path : '',
    missing412Strategy: p.missing412Strategy ?? 'stop',
  }

  if (typeof p.file412Content === 'string' && p.file412Content.length > 0) {
    payload.file412Content = p.file412Content
    if (typeof p.file412FileName === 'string') {
      payload.file412FileName = p.file412FileName
    }
  }

  if (args.common.parallel) {
    payload.parallel = true
  }

  return payload
}
