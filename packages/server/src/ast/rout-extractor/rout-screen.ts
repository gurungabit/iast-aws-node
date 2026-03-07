/**
 * ROUT Screen Abstraction - Host screen navigation for ROUT system.
 *
 * Provides named screen detection, section finding, queue listing,
 * and detail extraction for ROUT mode host screen-scraping.
 *
 * All row/col positions use 1-based indexing (Session convention).
 */

import type { Session } from '../session.js'
import type { QueueInfo, RouteItem, RoutExtractorConfig } from './models.js'
import { applyAllFilters } from './filters.js'

// Screen detection strings
const ROUT_CONTROL_TITLE = 'FIRE TERMINAL ROUTING CONTROL SCREEN'
const DETAIL_LISTING_TITLE = 'FIRE TERMINAL ROUTING DETAIL LISTING SCREEN'
const QUEUE_LISTING_MARKER = 'FIRE TERMINAL ROUTING QUEUE LISTING SCREEN'
const NO_MORE_OCCS = 'NO ADDITIONAL WORK ASSIGNMENTS'
const MULTI_ACCESS_WARNING = 'TERMINAL ROUTING MULTIPLE ACCESS WARNING'
const FSS_TITLE = 'Fire System Selection'
const PDQ_CONTROL_TITLE = 'PDQ Control'
const PDQ_NAME_TITLE = 'PDQ - Name and Address'
const PDQ_NO_RECORD = 'NO FMR RECORD FOUND'

export class RoutScreen {
  private session: Session

  constructor(session: Session) {
    this.session = session
  }

  // -- Screen Detection --

  isRoutControl(): boolean {
    return this.session.screenContains(ROUT_CONTROL_TITLE)
  }

  isDetailListing(): boolean {
    return this.session.screenContains(DETAIL_LISTING_TITLE)
  }

  isQueueListing(): boolean {
    return this.session.screenContains(QUEUE_LISTING_MARKER)
  }

  hasMultiAccessWarning(): boolean {
    return this.session.screenContains(MULTI_ACCESS_WARNING)
  }

  hasNoMoreOccs(): boolean {
    return this.session.screenContains(NO_MORE_OCCS)
  }

  isFss(): boolean {
    return this.session.screenContains(FSS_TITLE)
  }

  isPdqControl(): boolean {
    return this.session.screenContains(PDQ_CONTROL_TITLE)
  }

  isPdqName(): boolean {
    return this.session.screenContains(PDQ_NAME_TITLE)
  }

  // -- Navigation --

  async goToRoutControl(): Promise<boolean> {
    if (this.isRoutControl()) return true

    let maxAttempts = 10
    while (maxAttempts-- > 0) {
      if (this.isRoutControl()) return true
      await this.session.pf(15)
      if (await this.session.waitForText(ROUT_CONTROL_TITLE, 2)) return true
    }

    return false
  }

  async dismissMultiAccessWarning(): Promise<boolean> {
    if (!this.hasMultiAccessWarning()) return true
    await this.session.enter()
    await this.session.waitForKeyboard(2)
    return !this.hasMultiAccessWarning()
  }

  async cycleOcc(): Promise<boolean> {
    await this.session.pf(23)
    await this.session.waitForKeyboard(3)
    return !this.hasNoMoreOccs()
  }

  getCurrentOccurrence(): string {
    // RoutControl Occurrence field: row 8, col 1, length 43
    return this.session.getTextAt(8, 1, 43).trim()
  }

  getCurrentOccNumber(): number | null {
    const text = this.getCurrentOccurrence()
    const match = text.match(/OCC\s+(\d+)/i)
    return match ? parseInt(match[1], 10) : null
  }

  // -- Section Navigation --

  async findSection(sectionName: string): Promise<boolean> {
    let maxPages = 15
    while (maxPages-- > 0) {
      if (this.session.screenContains(sectionName.toUpperCase())) return true
      await this.session.pf(14)
      await this.session.waitForKeyboard(2)
      if (this.hasNoMoreOccs()) return false
    }
    return false
  }

  // -- Queue Operations --

  listQueuesInSection(): QueueInfo[] {
    const queues: QueueInfo[] = []

    // Queue listing items on rows 12-41 (1-based)
    for (let row = 12; row <= 41; row++) {
      const queueNum = this.session.getTextAt(row, 4, 3).trim()
      if (!queueNum || !/^\d+$/.test(queueNum)) continue

      const queueName = this.session.getTextAt(row, 9, 15).trim()
      const queueAndEmp = this.session.getTextAt(row, 26, 15).trim()
      const activeCountStr = this.session.getTextAt(row, 46, 3).trim()
      const activeCount = parseInt(activeCountStr, 10) || 0

      if (activeCount > 0) {
        queues.push({
          queueNum,
          queueName,
          queueAndEmpType: queueAndEmp,
          activeItemCount: activeCount,
        })
      }
    }

    return queues
  }

  async enterQueue(queueNum: string): Promise<boolean> {
    if (!this.isRoutControl() && !this.isQueueListing()) return false

    await this.session.fillFieldAtPosition(6, 9, `L${queueNum}`)
    await this.session.enter()
    await this.session.waitForText(DETAIL_LISTING_TITLE, 3)
    return this.isDetailListing()
  }

  async readDetailItems(
    sectionName: string,
    queueName: string,
    occurNum: string,
  ): Promise<RouteItem[]> {
    const items: RouteItem[] = []
    let page = 0
    const maxPages = 50

    while (page < maxPages) {
      const pageItems = this.readDetailPage(sectionName, queueName, occurNum)
      if (pageItems.length === 0) break
      items.push(...pageItems)

      await this.session.pf(14)
      await this.session.waitForKeyboard(2)

      if (!this.isDetailListing()) break
      page++
    }

    return items
  }

  private readDetailPage(sectionName: string, queueName: string, occurNum: string): RouteItem[] {
    const items: RouteItem[] = []

    for (let row = 12; row <= 41; row++) {
      const numStr = this.session.getTextAt(row, 1, 4).trim()
      if (!numStr || !/^\d+$/.test(numStr)) continue

      const policyRaw = this.session.getTextAt(row, 7, 14).trim()
      const team = this.session.getTextAt(row, 23, 3).trim()
      const agent = this.session.getTextAt(row, 28, 4).trim()
      const afoCode = this.session.getTextAt(row, 33, 2).trim()
      const policyType = this.session.getTextAt(row, 37, 4).trim()
      const description = this.session.getTextAt(row, 63, 18).trim()

      const { pui, highOrder, termDigits, checkDigit, companyCode } =
        parseScreenPolicyNumber(policyRaw)

      const policyNumber = `${pui}-${highOrder}-${termDigits}-${checkDigit}`
      const policyNumberFmt = `${highOrder}${termDigits}${pui}`
      const agentNafo = `${agent}/${afoCode}`

      items.push({
        policyNumber,
        policyNumberFmt,
        pui,
        companyCode,
        highOrder,
        termDigits,
        checkDigit,
        policyItem: '',
        policyType,
        gfuCode: '',
        team,
        agentNafo,
        agent,
        afo: afoCode,
        gfuDate: '',
        sectionOfRout: sectionName,
        description,
        whosQueue: '',
        specificQueue: '',
        servOrUndr: '',
        queueName,
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
        occurNum,
        oldPolicyNumber: '',
        timeQuoted: '',
        cancelEffDate: '',
        statusCode: '',
        officeNum: '',
        dateOfRun: '',
        alias: '',
        needsPdqEnrichment: policyType.trim() === '',
      })
    }

    return items
  }

  async returnToRoutControl(): Promise<boolean> {
    let maxAttempts = 10
    while (maxAttempts-- > 0) {
      if (this.isRoutControl()) return true
      await this.session.pf(15)
      if (await this.session.waitForText(ROUT_CONTROL_TITLE, 2)) return true
    }
    return this.isRoutControl()
  }

  // -- PDQ Enrichment --

  async lookupPdqType(policyNumber: string, companyCode = ''): Promise<string | null> {
    const parts = policyNumber.split('-')
    if (parts.length !== 4) return null

    const [pui, ho, term, check] = parts

    try {
      // Ensure we're on FSS
      if (!this.isFss()) {
        await this.navigateToFss()
        if (!this.isFss()) return null
      }

      // FSS -> PDQControl
      await this.session.waitForKeyboard(1)
      await this.session.fillFieldAtPosition(40, 36, 'PDQ')
      await this.session.enter()

      if (!(await this.session.waitForText(PDQ_CONTROL_TITLE, 5))) {
        await this.backOutToFss()
        return null
      }

      // PDQControl -> PDQName
      await this.session.waitForKeyboard(1)
      await this.session.fillFieldAtPosition(6, 10, ho)
      await this.session.fillFieldAtPosition(6, 12, term)
      await this.session.fillFieldAtPosition(6, 17, pui)
      if (companyCode.trim()) {
        await this.session.fillFieldAtPosition(6, 20, companyCode)
      }
      await this.session.fillFieldAtPosition(6, 22, check)
      await this.session.fillFieldAtPosition(27, 42, 'NAME')
      await this.session.enter()

      const matched = await this.session.waitForAnyText([PDQ_NAME_TITLE, PDQ_NO_RECORD], 1)

      if (matched === PDQ_NO_RECORD || (!matched && this.session.screenContains(PDQ_NO_RECORD))) {
        await this.backOutToFss()
        return null
      }

      if (!matched) {
        await this.backOutToFss()
        return null
      }

      // Read Type field (row 6, col 59, length 18)
      const pdqType = this.session.getTextAt(6, 59, 18).trim()
      await this.backOutToFss()

      return pdqType || null
    } catch {
      await this.backOutToFss()
      return null
    }
  }

  private async navigateToFss(): Promise<void> {
    let maxAttempts = 10
    while (maxAttempts-- > 0) {
      if (this.isFss()) return
      await this.session.pf(15)
      if (await this.session.waitForText(FSS_TITLE, 2)) return
    }
  }

  private async backOutToFss(): Promise<void> {
    let maxAttempts = 10
    while (maxAttempts-- > 0) {
      if (this.isFss()) return
      await this.session.pf(15)
      if (await this.session.waitForText(FSS_TITLE, 2)) return
    }

    if (!this.isFss()) {
      await this.session.pa(3)
      await this.session.waitForText(FSS_TITLE, 3)
    }
  }

  // -- Process ROUT item (section + OCC) --

  async processRoutItem(
    item: Record<string, unknown>,
    config: RoutExtractorConfig | null,
  ): Promise<{ success: boolean; error: string; data: Record<string, unknown> }> {
    const occ = (item.occ as number) ?? 1
    const section = (item.section as string) ?? ''

    try {
      if (!this.isRoutControl() && !(await this.goToRoutControl())) {
        return { success: false, error: 'Failed to navigate to RoutControl', data: {} }
      }

      if (this.hasMultiAccessWarning()) {
        await this.dismissMultiAccessWarning()
      }

      // Navigate to target OCC
      const currentOcc = this.getCurrentOccNumber()
      if (currentOcc === null || currentOcc !== occ) {
        let found = false
        for (let attempts = 0; attempts < 12; attempts++) {
          if (!(await this.cycleOcc())) break
          if (this.getCurrentOccNumber() === occ) {
            found = true
            break
          }
        }
        if (!found && this.getCurrentOccNumber() !== occ) {
          return { success: false, error: `OCC ${occ} not found`, data: {} }
        }
      }

      const occurName = this.getCurrentOccurrence()

      // Find target section
      if (!(await this.findSection(section))) {
        return {
          success: true,
          error: '',
          data: { occ, section, occurrence: occurName, items: [], count: 0 },
        }
      }

      // List queues
      const queues = this.listQueuesInSection()
      const allSectionItems: Record<string, unknown>[] = []

      for (const queue of queues) {
        if (!(await this.enterQueue(queue.queueNum))) continue

        let detailItems = await this.readDetailItems(section, queue.queueName, String(occ))

        if (config) {
          detailItems = applyAllFilters(detailItems, config)
        }

        for (const di of detailItems) {
          allSectionItems.push(di as unknown as Record<string, unknown>)
        }

        await this.returnToRoutControl()
      }

      return {
        success: true,
        error: '',
        data: {
          occ,
          section,
          occurrence: occurName,
          items: allSectionItems,
          count: allSectionItems.length,
        },
      }
    } catch (err) {
      return { success: false, error: `ROUT processing error: ${err}`, data: {} }
    }
  }
}

function parseScreenPolicyNumber(raw: string): {
  pui: string
  highOrder: string
  termDigits: string
  checkDigit: string
  companyCode: string
} {
  const cleanedNoDash = raw.replace(/[\s-]/g, '')
  if (cleanedNoDash.length >= 10) {
    return {
      companyCode: cleanedNoDash[0],
      pui: cleanedNoDash.slice(1, 3),
      highOrder: cleanedNoDash.slice(3, 5),
      termDigits: cleanedNoDash.slice(5, 9),
      checkDigit: cleanedNoDash.length > 9 ? cleanedNoDash[9] : '',
    }
  }
  return { pui: '', highOrder: '', termDigits: '', checkDigit: '', companyCode: '' }
}
