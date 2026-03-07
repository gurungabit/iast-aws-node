/**
 * 412 File Parser - Fixed-width file parsing and transformation.
 *
 * The 412 file is a 1523-character fixed-width text file generated daily.
 * Each line contains one routing item with fields at defined column positions.
 */

import type { RouteItem } from './models.js'
import { getPolicyType } from './policy-types.js'
import { FTP_412_PATH, FTP_412_CANADA_PATH } from '../../integrations/smb-paths.js'

// Field specs: [fieldName, start1Based, length]
const FIELD_SPECS: Array<[string, number, number]> = [
  ['office_num', 1, 2],
  ['division', 3, 1],
  ['numeric_company_code', 4, 1],
  ['pui', 5, 2],
  ['alpha_company_code', 7, 1],
  ['high_order', 8, 2],
  ['term_digits', 10, 4],
  ['check_digit', 14, 1],
  ['agent', 22, 4],
  ['afo', 29, 4],
  ['pt_written_date', 34, 8],
  ['pt_written_time', 43, 6],
  ['pt_effective_date', 50, 8],
  ['received_date', 59, 8],
  ['queue_name', 68, 15],
  ['queue_detail', 84, 15],
  ['text_message1', 100, 50],
  ['text_message2', 151, 50],
  ['text_message3', 202, 50],
  ['text_message4', 253, 50],
  ['stream_id', 307, 1],
  ['images', 309, 1],
  ['last_working_user', 311, 6],
  ['status', 318, 1],
  ['serv_or_undr', 320, 1],
  ['policy_item', 322, 10],
  ['system_policy_type', 333, 2],
  ['system_form_line', 336, 2],
  ['car_code', 339, 2],
  ['flmp_code', 342, 5],
  // Rout action sets 1-5
  ['rout_from_user1', 348, 6],
  ['rout_to_user1', 355, 6],
  ['rout_action1', 362, 6],
  ['rout_action_date1', 369, 8],
  ['und_serv1', 378, 1],
  ['pend_action1', 380, 6],
  ['pend_user1', 387, 6],
  ['pend_till1', 394, 8],
  ['pend_date1', 403, 8],
  ['rout_from_user2', 412, 6],
  ['rout_to_user2', 419, 6],
  ['rout_action2', 426, 6],
  ['rout_action_date2', 433, 8],
  ['und_serv2', 442, 1],
  ['pend_action2', 444, 6],
  ['pend_user2', 451, 6],
  ['pend_till2', 458, 8],
  ['pend_date2', 467, 8],
  ['rout_from_user3', 476, 6],
  ['rout_to_user3', 483, 6],
  ['rout_action3', 490, 6],
  ['rout_action_date3', 497, 8],
  ['und_serv3', 506, 1],
  ['pend_action3', 508, 6],
  ['pend_user3', 515, 6],
  ['pend_till3', 522, 8],
  ['pend_date3', 531, 8],
  ['rout_from_user4', 540, 6],
  ['rout_to_user4', 547, 6],
  ['rout_action4', 554, 6],
  ['rout_action_date4', 561, 8],
  ['und_serv4', 570, 1],
  ['pend_action4', 572, 6],
  ['pend_user4', 579, 6],
  ['pend_till4', 586, 8],
  ['pend_date4', 595, 8],
  ['rout_from_user5', 604, 6],
  ['rout_to_user5', 611, 6],
  ['rout_action5', 618, 6],
  ['rout_action_date5', 625, 8],
  ['und_serv5', 634, 1],
  ['pend_action5', 636, 6],
  ['pend_user5', 643, 6],
  ['pend_till5', 650, 8],
  ['pend_date5', 659, 8],
  // Post-rout fields
  ['sort_area', 668, 1],
  ['audit', 670, 1],
  ['county', 672, 3],
  ['zone', 676, 2],
  ['clnt_id', 679, 11],
  ['description', 691, 30],
  ['gfu_code', 722, 4],
  ['gfu_error_text', 727, 231],
  // Error codes 1-8
  ['error_code1', 959, 11],
  ['error_code2', 971, 11],
  ['error_code3', 983, 11],
  ['error_code4', 995, 11],
  ['error_code5', 1007, 11],
  ['error_code6', 1019, 11],
  ['error_code7', 1031, 11],
  ['error_code8', 1043, 11],
  ['remarks', 1055, 154],
  ['lob', 1210, 1],
  ['company_code', 1212, 1],
  ['unique_rout_id', 1214, 16],
  ['state_code', 1231, 2],
  ['anniv_date', 1234, 8],
  ['done_date', 1243, 8],
  ['done_user', 1252, 6],
  // MVR violation fields
  ['mvr_viol_date1', 1259, 8],
  ['mvr_viol_info1', 1268, 40],
  ['mvr_viol_date2', 1309, 8],
  ['mvr_viol_info2', 1318, 40],
  ['mvr_viol_date3', 1359, 8],
  ['mvr_viol_info3', 1368, 40],
  ['mvr_viol_date4', 1409, 8],
  ['mvr_viol_info4', 1418, 40],
  ['mvr_viol_date5', 1459, 8],
  ['mvr_viol_info5', 1468, 40],
  ['cancel_eff_date', 1513, 8],
  ['status_code', 1522, 2],
]

// eslint-disable-next-line no-control-regex
const NULL_BYTE_RE = /\u0000/g

function extractField(line: string, start1Based: number, length: number): string {
  const start0 = start1Based - 1
  return line
    .slice(start0, start0 + length)
    .replace(NULL_BYTE_RE, '')
    .trim()
}

function parse412Line(line: string): Record<string, string> {
  const record: Record<string, string> = {}
  for (const [fieldName, start, length] of FIELD_SPECS) {
    if (start + length - 1 <= line.length) {
      record[fieldName] = extractField(line, start, length)
    } else {
      record[fieldName] = ''
    }
  }
  return record
}

function formatGfuDate(receivedDate: string): string {
  if (receivedDate.length < 8) return ''
  return `${receivedDate.slice(4, 6)}/${receivedDate.slice(6, 8)}/${receivedDate.slice(2, 4)}`
}

function countErrors(record: Record<string, string>): number {
  let count = 0
  for (let i = 1; i <= 8; i++) {
    if (record[`error_code${i}`]) count++
  }
  return count
}

function deriveSectionOfRout(record: Record<string, string>): string {
  const queueName = (record.queue_name ?? '').trim().toUpperCase()
  const routedActions = new Set(['ROUTED', 'RUSHED', 'SENT'])

  if (queueName === 'OPERATOR') {
    for (let i = 1; i <= 5; i++) {
      const action = (record[`rout_action${i}`] ?? '').trim().toUpperCase()
      if (routedActions.has(action)) return 'ROUTED ITEMS'
    }
  }

  const policyItem = (record.policy_item ?? '').trim().toUpperCase()
  const policyItemMap: Record<string, string> = {
    ERROR: 'ERROR MEMOS',
    GFU: 'GENERAL FOLLOW UP MEMOS',
    ECHOPT: 'ECHO POLICY TRANSACTIONS',
    PLUA: 'PLUP ACTIVITY MESSAGES',
    MVR: 'MOTOR VEHICLE REPORTS',
    INTERNETPT: 'INTERNET POLICY TRANSACTIONS',
    SAS: 'SPECIAL ACCOUNT SYSTEM',
    MPPPT: 'MONTHLY PAYMENT POLICY TRANSACTIONS',
    QUOTE: 'QUOTE RESULTS',
    STS: 'STATE TO STATE TRANSFERS',
  }
  return policyItemMap[policyItem] ?? ''
}

function transformRecord(raw: Record<string, string>, dateOfRun: string): RouteItem {
  // Monthly payment FormLine override
  const sysType = (raw.system_policy_type ?? '').trim()
  let formLine = (raw.system_form_line ?? '').trim()
  const flmpCode = (raw.flmp_code ?? '').trim()
  if (sysType === 'M' && flmpCode) {
    formLine = flmpCode.slice(0, 2)
  }

  const pui = raw.pui ?? ''
  const highOrder = raw.high_order ?? ''
  const termDigits = raw.term_digits ?? ''
  const checkDigit = raw.check_digit ?? ''
  const policyNumber = `${pui}-${highOrder}-${termDigits}-${checkDigit}`
  const policyNumberFmt = `${highOrder}${termDigits}${pui}`
  const policyType = getPolicyType(sysType, formLine)
  const sectionOfRout = deriveSectionOfRout(raw)
  const gfuDate = formatGfuDate(raw.received_date ?? '')
  const noOfErrors = countErrors(raw)
  const images = (raw.images ?? '') === '*' ? 'Y' : 'N'
  const streamed = raw.stream_id ?? ''

  const agent = raw.agent ?? ''
  const afo = raw.afo ?? ''
  const agentNafo = afo.length >= 4 ? `${agent}/${afo.slice(2, 4)}` : `${agent}/`

  const queueDetail = raw.queue_detail ?? ''
  const team = queueDetail.length === 1 ? queueDetail : ''
  const servOrUndr = raw.serv_or_undr ?? ''
  const whosQueue = queueDetail
  const specificQueue = `${queueDetail}/${servOrUndr || '? AREA NOT SPECIFIED'}`

  const policyItem = (raw.policy_item ?? '').trim()
  const gfuErrorText = (raw.gfu_error_text ?? '').trim()
  const descriptionRaw = (raw.description ?? '').trim()
  const description =
    policyItem.toUpperCase() === 'GFU' ? gfuErrorText.slice(0, 50) : descriptionRaw

  return {
    policyNumber,
    policyNumberFmt,
    pui,
    companyCode: raw.company_code ?? '',
    highOrder,
    termDigits,
    checkDigit,
    policyItem,
    policyType,
    gfuCode: (raw.gfu_code ?? '').trim(),
    team,
    agentNafo,
    agent,
    afo,
    gfuDate,
    sectionOfRout,
    description,
    whosQueue,
    specificQueue,
    servOrUndr,
    queueName: (raw.queue_name ?? '').trim(),
    noOfErrors,
    errorCode1: raw.error_code1 ?? '',
    errorCode2: raw.error_code2 ?? '',
    errorCode3: raw.error_code3 ?? '',
    errorCode4: raw.error_code4 ?? '',
    errorCode5: raw.error_code5 ?? '',
    errorCode6: raw.error_code6 ?? '',
    errorCode7: raw.error_code7 ?? '',
    errorCode8: raw.error_code8 ?? '',
    streamed,
    images,
    status: raw.status ?? '',
    queueDetail,
    remarks: raw.remarks ?? '',
    uniqueRoutId: raw.unique_rout_id ?? '',
    stateCode: raw.state_code ?? '',
    annivDate: raw.anniv_date ?? '',
    flmpCode,
    audit: raw.audit ?? '',
    county: raw.county ?? '',
    clntId: raw.clnt_id ?? '',
    textMessage1: raw.text_message1 ?? '',
    routFromUser1: raw.rout_from_user1 ?? '',
    routActionDate1: raw.rout_action_date1 ?? '',
    systemPolicyType: sysType,
    systemFormLine: formLine,
    queueNum: '',
    occurNum: '',
    oldPolicyNumber: '',
    timeQuoted: '',
    cancelEffDate: raw.cancel_eff_date ?? '',
    statusCode: raw.status_code ?? '',
    officeNum: raw.office_num ?? '',
    dateOfRun,
    alias: '',
    needsPdqEnrichment: policyType === '',
  }
}

/** Parse an entire 412 file into a list of RouteItems */
export function parse412File(fileContent: string, dateOfRun?: string): RouteItem[] {
  const runDate = dateOfRun || new Date().toLocaleDateString('en-US')
  const items: RouteItem[] = []
  const lines = fileContent.split('\n')

  for (const line of lines) {
    if (!line.trim()) continue
    if (line.length < 322) continue

    try {
      const raw = parse412Line(line)
      const item = transformRecord(raw, runDate)
      items.push(item)
    } catch {
      // skip unparseable lines
    }
  }

  return items
}

/** Resolve the UNC path for the 412 file */
export function resolve412Path(oc: string, customPath?: string): string {
  if (customPath) return customPath
  const filename = `R${oc}.fire.rw412.txt`
  const basePath = oc === '03' ? FTP_412_CANADA_PATH : FTP_412_PATH
  return `${basePath}\\${filename}`
}
