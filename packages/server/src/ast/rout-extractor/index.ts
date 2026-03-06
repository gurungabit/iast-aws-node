/**
 * RoutExtractor AST - Extract and filter Fire ROUT items.
 * Ported from Python rout_extractor.py.
 *
 * Two data source modes:
 * 1. 412 File Mode (default): Parse fixed-width FTP file, transform, filter,
 *    optionally enrich blank PolicyTypes via PDQ.
 * 2. ROUT Mode: Navigate mainframe ROUT system via host screen scraping
 *    to extract queue items from OCC/SUPV queues.
 */

import type { Ati } from 'tnz3270-node'
import type { ProgressReporter } from '../progress.js'
import type { ASTContext } from '../executor.js'
import { randomUUID } from 'crypto'
import { Session } from '../session.js'
import type { RouteItem, RoutExtractorConfig } from './models.js'
import { buildConfig } from './models.js'
import { parse412File, resolve412Path } from './file-412.js'
import { applyAllFilters } from './filters.js'
import { getPolicyTypeFromPdq } from './policy-types.js'
import { RoutScreen } from './rout-screen.js'
import { config as serverConfig } from '../../config.js'

// Auth config for Fire system
const AUTH_CONFIG = {
  expectedKeywords: ['Fire System Selection'],
  group: '@OOFIRE',
}

interface WorkItem {
  id: string
  mode: '412' | 'rout'
  policy?: string
  routeItem?: RouteItem
  bulkResult?: Record<string, unknown>
  occ?: number
  section?: string
  index: number
}

export async function runRoutExtractorAST(
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

  // Build config
  const config = buildConfig(params)

  // Set auth application dynamically from OC
  const authApplication = `FIRE${config.oc}`

  reporter.reportProgress(0, 1, 'Preparing items...')

  // Prepare items based on source mode
  let workItems: WorkItem[]
  if (config.sourceMode === '412') {
    workItems = await prepareFrom412(params, config, reporter)
  } else {
    workItems = prepareFromRout(config, reporter)
  }

  if (workItems.length === 0) {
    reporter.reportProgress(1, 1, 'No items to process')
    return
  }

  // Separate bulk items (pre-computed) from items needing host interaction
  const bulkItems = workItems.filter((w) => w.bulkResult)
  const hostItems = workItems.filter((w) => !w.bulkResult)

  // Report bulk items immediately (no host session needed)
  if (bulkItems.length > 0) {
    reporter.reportProgress(0, workItems.length, `Storing ${bulkItems.length} pre-computed records...`)
    for (const item of bulkItems) {
      reporter.addItem({
        id: randomUUID(),
        policyNumber: item.id,
        status: 'success',
        durationMs: 0,
        data: item.bulkResult,
      })
    }
  }

  // If no items need host interaction, we're done
  if (hostItems.length === 0) {
    reporter.reportProgress(workItems.length, workItems.length, 'Route Extractor complete')
    return
  }

  // Authenticate for items needing host interaction
  reporter.reportProgress(bulkItems.length, workItems.length, 'Logging in...')

  const auth = await session.authenticate({
    username,
    password,
    ...AUTH_CONFIG,
    application: authApplication,
  })

  if (!auth.success) {
    throw new Error(`Login failed: ${auth.error}`)
  }

  const routScreen = new RoutScreen(session)

  // Process items needing host interaction
  for (let i = 0; i < hostItems.length; i++) {
    await ctx.checkpoint()

    const item = hostItems[i]
    const startTime = Date.now()
    const itemIndex = bulkItems.length + i + 1

    reporter.reportProgress(itemIndex, workItems.length, `Processing ${item.id}`)

    try {
      let data: Record<string, unknown>

      if (item.mode === '412' && item.routeItem) {
        // PDQ enrichment for 412 items with blank PolicyType
        data = await process412Item(routScreen, item.routeItem, config)
      } else if (item.mode === 'rout') {
        // ROUT screen scraping
        const result = await routScreen.processRoutItem(
          { occ: item.occ, section: item.section },
          config,
        )
        if (!result.success) {
          throw new Error(result.error)
        }
        data = result.data
      } else {
        data = {}
      }

      const durationMs = Date.now() - startTime
      reporter.addItem({
        id: randomUUID(),
        policyNumber: item.id,
        status: 'success',
        durationMs,
        data,
      })
    } catch (err) {
      const durationMs = Date.now() - startTime
      reporter.addItem({
        id: randomUUID(),
        policyNumber: item.id,
        status: 'error',
        durationMs,
        error: String(err),
      })
    }
  }

  // Logoff
  reporter.reportProgress(workItems.length, workItems.length, 'Logging off...')
  await session.logoff({ usePa3: true })
}

async function prepareFrom412(
  params: Record<string, unknown>,
  config: RoutExtractorConfig,
  reporter: ProgressReporter,
): Promise<WorkItem[]> {
  let allItems: RouteItem[] = []

  // Check for uploaded file content (base64-encoded from browser)
  const uploadedContent = params.file412Content as string | undefined
  if (uploadedContent) {
    reporter.reportProgress(0, 1, 'Decoding uploaded 412 file...')
    try {
      const fileContent = Buffer.from(uploadedContent, 'base64').toString('latin1')
      const dateOfRun = new Date().toLocaleDateString('en-US')
      reporter.reportProgress(0, 1, 'Parsing 412 file...')
      allItems = parse412File(fileContent, dateOfRun)
      reporter.reportProgress(0, 1, `Parsed ${allItems.length} records from 412 file`)
    } catch (err) {
      reporter.reportProgress(0, 1, `Failed to decode uploaded 412 file: ${err}`)
      return []
    }
  } else {
    // Download from SMB
    reporter.reportProgress(0, 1, 'Resolving 412 file path...')
    const filePath = resolve412Path(config.oc, config.file412Path)
    reporter.reportProgress(0, 1, `Downloading 412 file from ${filePath}...`)

    try {
      const { readSmbFile } = await import('../../integrations/smb.js')
      const smbConfig = {
        share: serverConfig.smbShare,
        domain: serverConfig.smbDomain,
        username: serverConfig.smbUsername,
        password: serverConfig.smbPassword,
      }
      const data = await readSmbFile(smbConfig, filePath)
      const fileContent = data.toString('latin1')
      const dateOfRun = new Date().toLocaleDateString('en-US')
      reporter.reportProgress(0, 1, 'Parsing 412 file...')
      allItems = parse412File(fileContent, dateOfRun)
      reporter.reportProgress(0, 1, `Parsed ${allItems.length} records from 412 file`)
    } catch {
      reporter.reportProgress(0, 1, '412 file unavailable')
      // Handle fallback strategy
      if (config.missing412Strategy === 'use_rout') {
        reporter.reportProgress(0, 1, 'Falling back to ROUT mode...')
        return prepareFromRout(config, reporter)
      }
      return []
    }
  }

  // Apply filters
  reporter.reportProgress(0, 1, 'Applying filters...')
  const filtered = applyAllFilters(allItems, config)
  reporter.reportProgress(0, 1, `Filtered to ${filtered.length} records (from ${allItems.length} total)`)

  // Split into bulk (resolved PolicyType) and PDQ-needing items
  const items: WorkItem[] = []
  let pdqCount = 0

  for (let i = 0; i < filtered.length; i++) {
    const routeItem = filtered[i]
    const workItem: WorkItem = {
      id: routeItem.policyNumber,
      policy: routeItem.policyNumber,
      index: i,
      routeItem,
      mode: '412',
    }

    if (config.updateRouteItems && routeItem.needsPdqEnrichment) {
      pdqCount++
    } else {
      // Pre-computed - no host interaction needed
      workItem.bulkResult = routeItem as unknown as Record<string, unknown>
    }

    items.push(workItem)
  }

  if (pdqCount > 0) {
    reporter.reportProgress(0, 1,
      `${filtered.length - pdqCount} items ready for bulk insert, ${pdqCount} items need PDQ enrichment`,
    )
  }

  return items
}

function prepareFromRout(
  config: RoutExtractorConfig,
  reporter: ProgressReporter,
): WorkItem[] {
  const workItems: WorkItem[] = []
  let itemIdx = 0

  const occRange = config.navigateAllOccs
    ? Array.from({ length: config.endOcc - config.startOcc + 1 }, (_, i) => config.startOcc + i)
    : [config.startOcc]

  for (const occ of occRange) {
    for (const section of config.sections) {
      workItems.push({
        id: `OCC${occ}-${section}`,
        occ,
        section,
        mode: 'rout',
        index: itemIdx++,
      })
    }
  }

  reporter.reportProgress(0, 1,
    `Prepared ${workItems.length} ROUT work items (${occRange.length} OCCs x ${config.sections.length} sections)`,
  )

  return workItems
}

async function process412Item(
  routScreen: RoutScreen,
  routeItem: RouteItem,
  config: RoutExtractorConfig,
): Promise<Record<string, unknown>> {
  // PDQ enrichment for items with blank PolicyType
  if (config.updateRouteItems && routeItem.needsPdqEnrichment) {
    try {
      const pdqDisplay = await routScreen.lookupPdqType(
        routeItem.policyNumber,
        routeItem.companyCode,
      )
      if (pdqDisplay) {
        const resolvedType = getPolicyTypeFromPdq(pdqDisplay)
        if (resolvedType) {
          routeItem.policyType = resolvedType
          routeItem.needsPdqEnrichment = false
        }
      }
    } catch {
      // PDQ enrichment failed - continue with blank PolicyType
    }
  }

  return routeItem as unknown as Record<string, unknown>
}
