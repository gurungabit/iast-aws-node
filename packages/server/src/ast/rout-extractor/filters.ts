/**
 * Filtering logic for RoutExtractor items.
 * Ported from Python filters.py.
 *
 * Three filter dimensions:
 * 1. Status: Active (A), Pended (P), or all
 * 2. Section: Which ROUT sections to include
 * 3. Unit exclusion: PUIs to skip
 */

import type { RouteItem, RoutExtractorConfig } from './models.js'
import { SECTION_NAMES } from './models.js'

/** Maps section display name -> PolicyItem value used in 412 mode */
const SECTION_TO_POLICY_ITEM: Record<string, string> = {
  'ECHO POLICY TRANSACTIONS': 'ECHOPT',
  'ERROR MEMOS': 'ERROR',
  'GENERAL FOLLOW UP MEMOS': 'GFU',
  'INTERNET POLICY TRANSACTIONS': 'INTERNETPT',
  'MONTHLY PAYMENT POLICY TRANSACTIONS': 'MPPPT',
  'MOTOR VEHICLE REPORTS': 'MVR',
  'PLUP ACTIVITY MESSAGES': 'PLUA',
  'QUOTE RESULTS': 'QUOTE',
  'STATE TO STATE TRANSFERS': 'STS',
}

export function filterByStatus(items: RouteItem[], config: RoutExtractorConfig): RouteItem[] {
  if (config.statusOther) return items

  const allowed = new Set<string>()
  if (config.statusActive) allowed.add('A')
  if (config.statusPended) allowed.add('P')

  if (allowed.size === 0) return []

  return items.filter((item) => allowed.has(item.status.trim().toUpperCase()))
}

export function filterBySections(items: RouteItem[], config: RoutExtractorConfig): RouteItem[] {
  const selected = new Set(config.sections)
  if (selected.size === 0) return []

  // If all sections selected, no filtering needed
  if (selected.size === SECTION_NAMES.length && SECTION_NAMES.every((s) => selected.has(s))) {
    return items
  }

  const includeRouted = selected.has('ROUTED ITEMS')

  // Build set of PolicyItem values for non-ROUTED sections
  const allowedPolicyItems = new Set<string>()
  for (const section of selected) {
    if (section !== 'ROUTED ITEMS' && section in SECTION_TO_POLICY_ITEM) {
      allowedPolicyItems.add(SECTION_TO_POLICY_ITEM[section])
    }
  }

  const result: RouteItem[] = []
  for (const item of items) {
    const sectionOfRout = item.sectionOfRout.trim()
    const policyItem = item.policyItem.trim()

    if (sectionOfRout === 'ROUTED ITEMS') {
      if (includeRouted) result.push(item)
      continue
    }

    if (allowedPolicyItems.has(policyItem)) {
      result.push(item)
    }
  }

  return result
}

export function filterByUnitExclusions(items: RouteItem[], config: RoutExtractorConfig): RouteItem[] {
  if (config.unitExclusions.length === 0) return items

  const excluded = new Set(config.unitExclusions.map((u) => u.trim().toUpperCase()).filter(Boolean))
  if (excluded.size === 0) return items

  return items.filter((item) => !excluded.has(item.pui.trim().toUpperCase()))
}

export function applyAllFilters(items: RouteItem[], config: RoutExtractorConfig): RouteItem[] {
  let result = filterByStatus(items, config)
  result = filterBySections(result, config)
  result = filterByUnitExclusions(result, config)
  return result
}
