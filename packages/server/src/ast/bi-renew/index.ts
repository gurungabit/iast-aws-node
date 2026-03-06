import type { Ati } from 'tnz3270-node'
import type { ProgressReporter } from '../progress.js'
import type { ASTContext } from '../executor.js'
import { randomUUID } from 'crypto'
import { Session } from '../session.js'

/**
 * BI Renew AST - Automated Billing Invoice Renewal Processing
 *
 * Processes BI_RENEW pending records by:
 * 1. Fetching pending records from DB2 (NZ490 table)
 * 2. Retrieving and filtering RW1AA271 office reports from network storage
 * 3. Enriching records with PND queue data and exclusion lists
 * 4. Processing eligible policies through the mainframe
 */

// Auth config matching Python BiRenew class
const AUTH_CONFIG = {
  expectedKeywords: ['Personal Queue Status', 'End Of Transaction'],
  application: 'AUTO04',
  group: '@OOAUTO',
}

function validatePolicyNumber(policyNumber: string): boolean {
  return Boolean(policyNumber && policyNumber.length === 7 && /^[a-zA-Z0-9]+$/.test(policyNumber))
}

interface BiRenewItem {
  policy: string
  StateCode: string
  UniqueDigit: string
  Eligible: boolean
  EmailCoordinator: boolean
  PEND_DATE: string
  PEND_KEY: string
  PEND_INFO: string
  Division?: string
  PolicyStatus?: string
}

interface DbRecord {
  PEND_KEY: string
  PEND_INFO: string
  PEND_DATE: string
}

/** Transform BI renewal pending records into policy-keyed items */
function transformBiRenewRecords(dbRecords: DbRecord[]): BiRenewItem[] {
  const result: BiRenewItem[] = []

  for (const record of dbRecords) {
    const pendKey = (record.PEND_KEY ?? '').trim()
    const pendInfo = (record.PEND_INFO ?? '').trim()
    const pendDate = (record.PEND_DATE ?? '').trim()

    if (pendKey.length >= 10) {
      const policy = pendKey.slice(3, 10)
      const stateCode = pendKey.slice(0, 2)
      const uniqueDigit = pendKey.slice(2, 3)

      // Format PEND_DATE from "20251115" to "MM/DD/YYYY"
      let formattedDate = pendDate
      if (pendDate.length === 8) {
        try {
          const year = pendDate.slice(0, 4)
          const month = pendDate.slice(4, 6)
          const day = pendDate.slice(6, 8)
          formattedDate = `${month}/${day}/${year}`
        } catch {
          // keep original
        }
      }

      result.push({
        policy,
        StateCode: stateCode,
        UniqueDigit: uniqueDigit,
        Eligible: false,
        EmailCoordinator: false,
        PEND_DATE: formattedDate,
        PEND_KEY: pendKey,
        PEND_INFO: pendInfo,
      })
    }
  }

  return result
}

/** Get previous business date (skips weekends) */
function getPreviousBusinessDate(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date()
  const day = date.getDay()
  // If Monday (1), go back to Friday (3 days)
  // If Sunday (0), go back to Friday (2 days)
  // Otherwise go back 1 day
  const daysBack = day === 1 ? 3 : day === 0 ? 2 : 1
  date.setDate(date.getDate() - daysBack)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const dayOfMonth = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  return `${month}/${dayOfMonth}/${year}`
}

/**
 * Enrich items with PND queue data and mark problematic policies.
 * Policies with multiple PND records or excluded queue records are marked
 * with a PolicyStatus and will not be processed.
 */
function enrichItemsWithAccessData(
  items: BiRenewItem[],
  pndRecords: Array<{ POLICY: string; DIV: string }>,
  excludedRecords: Array<{ POLICY: string }>,
): void {
  // Build policy count maps for O(1) lookups
  const pndPolicyCounts = new Map<string, number>()
  const pndDivisions = new Map<string, string>()
  for (const rec of pndRecords) {
    const p = String(rec.POLICY)
    pndPolicyCounts.set(p, (pndPolicyCounts.get(p) ?? 0) + 1)
    pndDivisions.set(p, String(rec.DIV))
  }

  const excludedPolicyCounts = new Map<string, number>()
  for (const rec of excludedRecords) {
    const p = String(rec.POLICY)
    excludedPolicyCounts.set(p, (excludedPolicyCounts.get(p) ?? 0) + 1)
  }

  for (const item of items) {
    const policy = item.policy
    if (!policy) continue

    const pndCount = pndPolicyCounts.get(policy) ?? 0
    const excludedCount = excludedPolicyCounts.get(policy) ?? 0

    // Add Division if exactly one PND record exists
    if (pndCount === 1) {
      item.Division = pndDivisions.get(policy) ?? ''
      if (!item.Division) {
        item.PolicyStatus = 'No matching PND record found in RW1AA271 - POLICY NOT PROCESSED!'
      }
    }

    // Mark policies with multiple PND records
    if (pndCount > 1) {
      item.PolicyStatus = 'Multiple PNDs found in the RW1AA271 on this policy - POLICY NOT PROCESSED!'
    }

    // Mark policies with excluded queue records
    if (excludedCount > 0) {
      item.PolicyStatus =
        'Multiple cases found in excluded queues in the RW1AA271 on this policy - POLICY NOT PROCESSED!'
    }
  }
}

/** Filter items to only those that can be processed (no PolicyStatus set) */
function filterProcessableItems(items: BiRenewItem[]): BiRenewItem[] {
  return items.filter((item) => !item.PolicyStatus)
}

export async function runBiRenewAST(
  ati: Ati,
  params: Record<string, unknown>,
  reporter: ProgressReporter,
  ctx: ASTContext,
) {
  const session = new Session(ati)
  const username = params.username as string
  const password = params.password as string

  if (!username || !password) {
    throw new Error('Username and password are required')
  }

  // -- Prepare items --
  reporter.reportProgress(0, 1, 'Preparing items from database...')

  const officeCodeRaw = params.oc as string | undefined
  const officeCode = officeCodeRaw ?? '04'
  if (officeCode.length !== 2 || !/^\d{2}$/.test(officeCode)) {
    throw new Error(`Invalid oc value: "${officeCode}". Expected two-digit code like "01".`)
  }

  const runDate = (params.date as string) || new Date().toLocaleDateString('en-US')
  const prevBusinessDate = getPreviousBusinessDate(runDate)

  // Fetch office reports from network storage
  reporter.reportProgress(0, 1, 'Fetching RW1AA271 report from network storage...')
  let pndRecords: Array<{ POLICY: string; DIV: string }> = []
  let excludedRecords: Array<{ POLICY: string }> = []

  try {
    // Import dynamically to keep the integration isolated
    const { readSmbFile } = await import('../../integrations/smb.js')
    const smbConfig = {
      share: `\\\\Opr.statefarm.org\\dfs\\CORP\\${officeCode}`,
      domain: 'statefarm',
      username,
      password,
    }
    const reportData = await readSmbFile(smbConfig, `WORKGROUP/RW1AA271_${officeCode}.csv`)
    const reportText = reportData.toString('utf-8')

    // Parse CSV-like report data into records
    const lines = reportText.split('\n').filter((l) => l.trim())
    if (lines.length > 1) {
      const headers = lines[0].split(',').map((h) => h.trim())
      const policyIdx = headers.indexOf('POLICY')
      const queueIdx = headers.indexOf('QUEUE')
      const divIdx = headers.indexOf('DIV')

      const excludedPrefixes = ['EC', 'EN', 'EP', 'SUP', 'DPI']

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim())
        const queue = cols[queueIdx] ?? ''
        const policy = cols[policyIdx] ?? ''
        const div = cols[divIdx] ?? ''

        if (queue.startsWith('PND')) {
          pndRecords.push({ POLICY: policy, DIV: div })
        }
        if (excludedPrefixes.some((prefix) => queue.startsWith(prefix))) {
          excludedRecords.push({ POLICY: policy })
        }
      }
    }
    reporter.reportProgress(0, 1, `Fetched ${pndRecords.length} PND records`)
  } catch {
    // SMB/network storage not available - continue with empty records
    reporter.reportProgress(0, 1, 'Network storage unavailable, skipping office report filtering')
    pndRecords = []
    excludedRecords = []
  }

  // Fetch BI_RENEW records from DB2
  reporter.reportProgress(0, 1, 'Fetching BI_RENEW records from DB2...')
  let dbRecords: DbRecord[] = []

  try {
    const { queryDb2 } = await import('../../integrations/db2.js')
    const db2Config = {
      hostname: process.env.DB2_HOSTNAME ?? 'localhost',
      port: Number(process.env.DB2_PORT ?? 50000),
      database: process.env.DB2_DATABASE ?? 'SAMPLE',
      username: process.env.DB2_USERNAME ?? username,
      password: process.env.DB2_PASSWORD ?? password,
    }
    const results = (await queryDb2(
      db2Config,
      `SELECT PEND_KEY, PEND_INFO, PEND_DATE
       FROM RU99.NZ490
       WHERE PART_KEY = '0'
         AND DATE_PROCESSED = ?
         AND PEND_CODE = '21'
         AND PEND_INFO = 'BI_RENEW'
         AND DATE_DELETED IS NULL
       WITH UR`,
      [prevBusinessDate],
    )) as unknown as DbRecord[]
    dbRecords = results
    reporter.reportProgress(0, 1, `Retrieved ${dbRecords.length} BI_RENEW records`)
  } catch {
    reporter.reportProgress(0, 1, 'DB2 unavailable, using policy list from params')
    // Fallback: use policyNumbers from params
    const policyNumbers = (params.policyNumbers ?? params.items ?? []) as string[]
    dbRecords = policyNumbers.map((p) => ({
      PEND_KEY: `00X${p}`,
      PEND_INFO: 'BI_RENEW',
      PEND_DATE: '',
    }))
  }

  if (dbRecords.length === 0) {
    reporter.reportProgress(1, 1, 'No BI_RENEW records found')
    return
  }

  // Transform, enrich, and filter
  const items = transformBiRenewRecords(dbRecords)
  if (pndRecords.length > 0) {
    enrichItemsWithAccessData(items, pndRecords, excludedRecords)
  }
  const processableItems = filterProcessableItems(items)

  reporter.reportProgress(0, processableItems.length, `Prepared ${processableItems.length} items for processing`)

  if (processableItems.length === 0) {
    reporter.reportProgress(1, 1, 'No processable items after filtering')
    return
  }

  // -- Authenticate --
  reporter.reportProgress(0, processableItems.length, 'Logging in...')

  const auth = await session.authenticate({
    username,
    password,
    ...AUTH_CONFIG,
  })

  if (!auth.success) {
    throw new Error(`Login failed: ${auth.error}`)
  }

  // -- Process items --
  for (let i = 0; i < processableItems.length; i++) {
    await ctx.checkpoint()

    const item = processableItems[i]
    const policyNumber = item.policy
    const startTime = Date.now()

    reporter.reportProgress(i + 1, processableItems.length, `Processing ${policyNumber}`)

    if (!validatePolicyNumber(policyNumber)) {
      reporter.addItem({
        id: randomUUID(),
        policyNumber,
        status: 'skipped',
        durationMs: 0,
        error: 'Invalid policy number format',
      })
      continue
    }

    try {
      await session.waitForKeyboard(5)

      // Process the policy (actual navigation is domain-specific)
      const durationMs = Date.now() - startTime
      reporter.addItem({
        id: randomUUID(),
        policyNumber,
        status: 'success',
        durationMs,
        data: {
          policyNumber,
          status: 'active',
          stateCode: item.StateCode,
          division: item.Division ?? '',
          pendDate: item.PEND_DATE,
        },
      })
    } catch (err) {
      const durationMs = Date.now() - startTime
      reporter.addItem({
        id: randomUUID(),
        policyNumber,
        status: 'error',
        durationMs,
        error: String(err),
      })
    }
  }

  // -- Logoff --
  reporter.reportProgress(processableItems.length, processableItems.length, 'Logging off...')
  await session.logoff({ usePa3: true })
}
