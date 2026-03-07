/** Normalized route item record - output of both ROUT and 412 pipelines */
export interface RouteItem {
  policyNumber: string
  policyNumberFmt: string
  pui: string
  companyCode: string
  highOrder: string
  termDigits: string
  checkDigit: string
  policyItem: string
  policyType: string
  gfuCode: string
  team: string
  agentNafo: string
  agent: string
  afo: string
  gfuDate: string
  sectionOfRout: string
  description: string
  whosQueue: string
  specificQueue: string
  servOrUndr: string
  queueName: string
  noOfErrors: number
  errorCode1: string
  errorCode2: string
  errorCode3: string
  errorCode4: string
  errorCode5: string
  errorCode6: string
  errorCode7: string
  errorCode8: string
  streamed: string
  images: string
  status: string
  queueDetail: string
  remarks: string
  uniqueRoutId: string
  stateCode: string
  annivDate: string
  flmpCode: string
  audit: string
  county: string
  clntId: string
  textMessage1: string
  routFromUser1: string
  routActionDate1: string
  systemPolicyType: string
  systemFormLine: string
  queueNum: string
  occurNum: string
  oldPolicyNumber: string
  timeQuoted: string
  cancelEffDate: string
  statusCode: string
  officeNum: string
  dateOfRun: string
  alias: string
  needsPdqEnrichment: boolean
}

export function createEmptyRouteItem(): RouteItem {
  return {
    policyNumber: '',
    policyNumberFmt: '',
    pui: '',
    companyCode: '',
    highOrder: '',
    termDigits: '',
    checkDigit: '',
    policyItem: '',
    policyType: '',
    gfuCode: '',
    team: '',
    agentNafo: '',
    agent: '',
    afo: '',
    gfuDate: '',
    sectionOfRout: '',
    description: '',
    whosQueue: '',
    specificQueue: '',
    servOrUndr: '',
    queueName: '',
    noOfErrors: 0,
    errorCode1: '',
    errorCode2: '',
    errorCode3: '',
    errorCode4: '',
    errorCode5: '',
    errorCode6: '',
    errorCode7: '',
    errorCode8: '',
    streamed: '',
    images: '',
    status: '',
    queueDetail: '',
    remarks: '',
    uniqueRoutId: '',
    stateCode: '',
    annivDate: '',
    flmpCode: '',
    audit: '',
    county: '',
    clntId: '',
    textMessage1: '',
    routFromUser1: '',
    routActionDate1: '',
    systemPolicyType: '',
    systemFormLine: '',
    queueNum: '',
    occurNum: '',
    oldPolicyNumber: '',
    timeQuoted: '',
    cancelEffDate: '',
    statusCode: '',
    officeNum: '',
    dateOfRun: '',
    alias: '',
    needsPdqEnrichment: false,
  }
}

/** Run configuration passed from the frontend */
export interface RoutExtractorConfig {
  sourceMode: '412' | 'rout'
  oc: string
  sections: string[]
  statusActive: boolean
  statusPended: boolean
  statusOther: boolean
  unitExclusions: string[]
  navigationMethod: 'occ' | 'supv' | null
  navigateAllOccs: boolean
  startOcc: number
  endOcc: number
  supvIds: string[]
  updateRouteItems: boolean
  file412Path: string
  missing412Strategy: 'use_rout' | 'stop' | 'wait'
}

/** Canonical section names matching the legacy RoutExtractorSections.xml */
export const SECTION_NAMES: string[] = [
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
]

/** A queue entry discovered from the ROUT queue listing screen */
export interface QueueInfo {
  queueNum: string
  queueName: string
  queueAndEmpType: string
  activeItemCount: number
}

export function buildConfig(params: Record<string, unknown>): RoutExtractorConfig {
  let sections: string[]
  const rawSections = params.sections
  if (Array.isArray(rawSections)) {
    sections = rawSections.filter((s): s is string => typeof s === 'string')
  } else {
    sections = [...SECTION_NAMES]
  }

  const unitExclusionsRaw = params.unitExclusions
  let unitExclusions: string[]
  if (typeof unitExclusionsRaw === 'string') {
    unitExclusions = unitExclusionsRaw
      .split(';')
      .map((u) => u.trim())
      .filter(Boolean)
  } else if (Array.isArray(unitExclusionsRaw)) {
    unitExclusions = unitExclusionsRaw as string[]
  } else {
    unitExclusions = []
  }

  const supvIdsRaw = params.supvIds
  let supvIds: string[]
  if (typeof supvIdsRaw === 'string') {
    supvIds = supvIdsRaw
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
  } else if (Array.isArray(supvIdsRaw)) {
    supvIds = supvIdsRaw as string[]
  } else {
    supvIds = []
  }

  return {
    sourceMode: (params.sourceMode as '412' | 'rout') ?? '412',
    oc: String(params.oc ?? '04'),
    sections,
    statusActive: (params.statusActive as boolean) ?? true,
    statusPended: (params.statusPended as boolean) ?? true,
    statusOther: (params.statusOther as boolean) ?? false,
    unitExclusions,
    navigationMethod: (params.navigationMethod as 'occ' | 'supv') ?? null,
    navigateAllOccs: (params.navigateAllOccs as boolean) ?? true,
    startOcc: Number(params.startOcc ?? 1),
    endOcc: Number(params.endOcc ?? 11),
    supvIds,
    updateRouteItems: (params.updateRouteItems as boolean) ?? false,
    file412Path: (params.file412Path as string) ?? '',
    missing412Strategy: (params.missing412Strategy as 'use_rout' | 'stop' | 'wait') ?? 'stop',
  }
}
