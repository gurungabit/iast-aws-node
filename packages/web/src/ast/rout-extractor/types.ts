export const ROUT_SECTIONS = [
  'ROUTED ITEMS',
  'ECHO POLICY TRANSACTIONS',
  'ERROR MEMOS',
  'GENERAL FOLLOW UP MEMOS',
  'INTERNET POLICY TRANSACTIONS',
  'MONTHLY PAYMENT POLICY TRANSACTIONS',
  'MOTOR VEHICLE REPORTS',
  'PLUP ACTIVITY MESSAGES',
  'QUOTE RESULTS',
  'STATE TO STATE TRANSFERS',
] as const

export type RoutSection = (typeof ROUT_SECTIONS)[number]
export type SourceMode = 'rout' | '412'
export type Missing412Strategy = 'use_rout' | 'stop' | 'wait'
export type NavigationMethod = 'occ' | 'supv'

export function getDefaultConfigParams(): Record<string, unknown> {
  return {
    sourceMode: '412' as SourceMode,
    sections: [...ROUT_SECTIONS],
    statusActive: true,
    statusPended: true,
    statusOther: false,
    unitExclusions: '',
    navigationMethod: 'occ' as NavigationMethod,
    navigateAllOccs: true,
    startOcc: 1,
    endOcc: 11,
    supvIds: '',
    updateRouteItems: true,
    file412Path: '',
    missing412Strategy: 'stop' as Missing412Strategy,
  }
}
