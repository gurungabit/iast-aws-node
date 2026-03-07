import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { setCacheRoot, getCacheRoot, loadFromCache, writeToCache } from '@src/ast/rout-extractor/cache.js'
import type { RouteItem } from '@src/ast/rout-extractor/models.js'

function makeRouteItem(policyNumber: string): RouteItem {
  return {
    policyNumber,
    policyNumberFmt: '',
    pui: '',
    companyCode: '',
    highOrder: '',
    termDigits: '',
    checkDigit: '',
    policyItem: '',
    policyType: 'AUTO',
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

describe('412 file cache', () => {
  let tempDir: string
  let originalRoot: string

  beforeEach(async () => {
    originalRoot = getCacheRoot()
    tempDir = await mkdtemp(join(tmpdir(), 'iast-cache-test-'))
    setCacheRoot(tempDir)
  })

  afterEach(async () => {
    setCacheRoot(originalRoot)
    await rm(tempDir, { recursive: true, force: true })
  })

  it('returns null on cache miss', async () => {
    const result = await loadFromCache('04')
    expect(result).toBeNull()
  })

  it('writes and reads back cached items', async () => {
    const items = [makeRouteItem('POL001'), makeRouteItem('POL002')]
    await writeToCache('04', items)

    const loaded = await loadFromCache('04')
    expect(loaded).toHaveLength(2)
    expect(loaded![0].policyNumber).toBe('POL001')
    expect(loaded![1].policyNumber).toBe('POL002')
  })

  it('creates subdirectory for OC automatically', async () => {
    await writeToCache('07', [makeRouteItem('X')])
    const loaded = await loadFromCache('07')
    expect(loaded).toHaveLength(1)
  })

  it('isolates cache by OC', async () => {
    await writeToCache('04', [makeRouteItem('A')])
    await writeToCache('07', [makeRouteItem('B'), makeRouteItem('C')])

    const oc04 = await loadFromCache('04')
    const oc07 = await loadFromCache('07')
    expect(oc04).toHaveLength(1)
    expect(oc07).toHaveLength(2)
  })

  it('returns null for corrupt cache data', async () => {
    // Write invalid JSON directly
    const { writeFile, mkdir } = await import('fs/promises')
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const dir = join(tempDir, '04')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, `rout_extractor_412_${y}_${m}_${d}.json`), 'not json{{{')

    const result = await loadFromCache('04')
    expect(result).toBeNull()
  })

  it('returns null when cache contains non-array JSON', async () => {
    const { writeFile, mkdir } = await import('fs/promises')
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const dir = join(tempDir, '04')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, `rout_extractor_412_${y}_${m}_${d}.json`), '{"not": "array"}')

    const result = await loadFromCache('04')
    expect(result).toBeNull()
  })

  it('stores valid JSON on disk', async () => {
    const items = [makeRouteItem('CHECK')]
    await writeToCache('04', items)

    // Read raw file and verify it's valid JSON
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const raw = await readFile(join(tempDir, '04', `rout_extractor_412_${y}_${m}_${d}.json`), 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].policyNumber).toBe('CHECK')
  })

  it('handles large datasets', async () => {
    const items = Array.from({ length: 10000 }, (_, i) => makeRouteItem(`POL${String(i).padStart(5, '0')}`))
    await writeToCache('04', items)

    const loaded = await loadFromCache('04')
    expect(loaded).toHaveLength(10000)
    expect(loaded![9999].policyNumber).toBe('POL09999')
  })

  it('does not throw when write fails (non-fatal)', async () => {
    // Point to a path that can't be created
    setCacheRoot('/dev/null/impossible/path')
    await expect(writeToCache('04', [makeRouteItem('X')])).resolves.toBeUndefined()
  })
})
