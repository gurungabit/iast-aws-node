/**
 * 412 File Cache - Caches parsed RouteItem[] to avoid redundant SMB downloads.
 *
 * Cache key: {cacheRoot}/{OC}/rout_extractor_412_{YYYY_MM_DD}.json
 * The 412 file is generated once per day, so the date-based key ensures
 * automatic expiration at midnight. Multiple users running the same OC
 * on the same day share the cached parse result.
 *
 * Uploaded files bypass the cache entirely.
 * Cache write failures are non-fatal (logged, not thrown).
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { RouteItem } from './models.js'

let cacheRoot = join(process.cwd(), '.cache', '412')

/** Override the cache root directory (for testing). */
export function setCacheRoot(dir: string) {
  cacheRoot = dir
}

export function getCacheRoot(): string {
  return cacheRoot
}

function buildCachePath(oc: string, date: string): string {
  // date format: YYYY_MM_DD
  return join(cacheRoot, oc, `rout_extractor_412_${date}.json`)
}

function todayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}_${m}_${d}`
}

/**
 * Try to load cached RouteItem[] for the given OC and today's date.
 * Returns null on cache miss or corrupt data.
 */
export async function loadFromCache(oc: string): Promise<RouteItem[] | null> {
  const path = buildCachePath(oc, todayKey())
  try {
    const raw = await readFile(path, 'utf-8')
    const items = JSON.parse(raw) as RouteItem[]
    if (!Array.isArray(items)) return null
    return items
  } catch {
    return null
  }
}

/**
 * Write parsed RouteItem[] to cache. Non-fatal on failure.
 */
export async function writeToCache(oc: string, items: RouteItem[]): Promise<void> {
  const date = todayKey()
  const path = buildCachePath(oc, date)
  try {
    await mkdir(join(cacheRoot, oc), { recursive: true })
    await writeFile(path, JSON.stringify(items))
  } catch (err) {
    console.warn(`Failed to write 412 cache: ${err instanceof Error ? err.message : String(err)}`)
  }
}
