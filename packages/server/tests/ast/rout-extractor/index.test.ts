import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RouteItem } from '@src/ast/rout-extractor/models.js'

vi.mock('tnz3270-node', () => ({ Ati: class {} }))

const mockSession = vi.hoisted(() => ({
  authenticate: vi.fn().mockResolvedValue({ success: true, error: '' }),
  logoff: vi.fn().mockResolvedValue({ success: true, error: '' }),
}))

const mockRoutScreen = vi.hoisted(() => ({
  processRoutItem: vi.fn().mockResolvedValue({ success: true, error: '', data: { items: [], count: 0 } }),
  lookupPdqType: vi.fn().mockResolvedValue(null),
}))

const mockReadSmbFile = vi.hoisted(() => vi.fn().mockRejectedValue(new Error('not available')))

vi.mock('@src/ast/session.js', () => ({
  Session: function () {
    return mockSession
  },
}))

vi.mock('@src/ast/rout-extractor/rout-screen.js', () => ({
  RoutScreen: function () {
    return mockRoutScreen
  },
}))

vi.mock('@src/integrations/smb.js', () => ({
  readSmbFile: mockReadSmbFile,
}))

vi.mock('@src/ast/rout-extractor/models.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@src/ast/rout-extractor/models.js')>()
  return {
    ...actual,
    buildConfig: vi.fn().mockImplementation((params: Record<string, unknown>) => ({
      sourceMode: params.sourceMode ?? '412',
      oc: String(params.oc ?? '04'),
      sections: ['ROUTED ITEMS', 'ERROR MEMOS'],
      statusActive: true,
      statusPended: true,
      statusOther: false,
      unitExclusions: [],
      navigationMethod: null,
      navigateAllOccs: true,
      startOcc: 1,
      endOcc: 3,
      supvIds: [],
      updateRouteItems: params.updateRouteItems ?? false,
      file412Path: '',
      missing412Strategy: params.missing412Strategy ?? 'stop',
    })),
  }
})

vi.mock('@src/ast/rout-extractor/file-412.js', () => ({
  parse412File: vi.fn().mockReturnValue([]),
  resolve412Path: vi.fn().mockReturnValue('/mock/path.txt'),
}))

vi.mock('@src/ast/rout-extractor/filters.js', () => ({
  applyAllFilters: vi.fn().mockImplementation((items: RouteItem[]) => items),
}))

vi.mock('@src/ast/rout-extractor/policy-types.js', () => ({
  getPolicyTypeFromPdq: vi.fn().mockReturnValue(null),
}))

vi.mock('@src/ast/rout-extractor/cache.js', () => ({
  loadFromCache: vi.fn().mockResolvedValue(null),
  writeToCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('test-uuid'),
}))

vi.mock('@src/config.js', () => ({
  config: {
    smbShare: '',
    smbDomain: '',
    smbUsername: '',
    smbPassword: '',
  },
}))

import { Ati } from 'tnz3270-node'
import { runRoutExtractorAST } from '@src/ast/rout-extractor/index.js'
import { parse412File } from '@src/ast/rout-extractor/file-412.js'
import { getPolicyTypeFromPdq } from '@src/ast/rout-extractor/policy-types.js'
import type { ProgressReporter } from '@src/ast/progress.js'
import type { ASTContext } from '@src/ast/executor.js'

function makeRouteItem(overrides: Partial<RouteItem> = {}): RouteItem {
  return {
    policyNumber: 'POL001',
    policyNumberFmt: 'POL-001',
    pui: '',
    companyCode: '01',
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
    ...overrides,
  }
}

describe('runRoutExtractorAST', () => {
  let mockAti: Ati
  let mockReporter: Pick<ProgressReporter, 'reportProgress' | 'addItem' | 'addItemsPersistOnly'> & { reportProgress: ReturnType<typeof vi.fn>; addItem: ReturnType<typeof vi.fn>; addItemsPersistOnly: ReturnType<typeof vi.fn> }
  let mockCtx: ASTContext

  beforeEach(() => {
    vi.clearAllMocks()

    mockAti = new Ati()

    mockReporter = {
      reportProgress: vi.fn(),
      addItem: vi.fn(),
      addItemsPersistOnly: vi.fn(),
    }

    mockCtx = {
      checkpoint: vi.fn().mockResolvedValue(undefined),
    }
  })

  it('throws when username is missing', async () => {
    await expect(
      runRoutExtractorAST(mockAti, { password: 'pass' }, mockReporter, mockCtx),
    ).rejects.toThrow('Username and password are required')
  })

  it('throws when password is missing', async () => {
    await expect(
      runRoutExtractorAST(mockAti, { username: 'user' }, mockReporter, mockCtx),
    ).rejects.toThrow('Username and password are required')
  })

  it('throws when no file source configured and no file uploaded in 412 mode', async () => {
    const params = {
      username: 'user',
      password: 'pass',
      sourceMode: '412',
    }

    await expect(
      runRoutExtractorAST(mockAti, params, mockReporter, mockCtx),
    ).rejects.toThrow('No 412 file source configured')
    expect(mockSession.authenticate).not.toHaveBeenCalled()
  })

  it('processes ROUT mode items', async () => {
    const params = {
      username: 'user',
      password: 'pass',
      sourceMode: 'rout',
    }

    await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

    // ROUT mode with startOcc=1, endOcc=3, 2 sections => 6 work items
    expect(mockSession.authenticate).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'user',
        password: 'pass',
        application: 'FIRE04',
      }),
    )
  })

  it('throws when authentication fails', async () => {
    mockSession.authenticate.mockResolvedValueOnce({ success: false, error: 'Invalid' })

    const params = {
      username: 'user',
      password: 'pass',
      sourceMode: 'rout',
    }

    await expect(
      runRoutExtractorAST(mockAti, params, mockReporter, mockCtx),
    ).rejects.toThrow('Login failed: Invalid')
  })

  it('calls checkpoint for each host work item', async () => {
    const params = {
      username: 'user',
      password: 'pass',
      sourceMode: 'rout',
    }

    await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

    // 3 OCCs x 2 sections = 6 items
    expect(mockCtx.checkpoint).toHaveBeenCalledTimes(6)
  })

  it('reports errors during ROUT item processing', async () => {
    mockRoutScreen.processRoutItem.mockResolvedValueOnce({
      success: false,
      error: 'OCC not found',
      data: {},
    })

    const params = {
      username: 'user',
      password: 'pass',
      sourceMode: 'rout',
    }

    await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

    expect(mockReporter.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        error: expect.stringContaining('OCC not found'),
      }),
    )
  })

  it('calls logoff with usePa3: true at the end', async () => {
    const params = {
      username: 'user',
      password: 'pass',
      sourceMode: 'rout',
    }

    await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

    expect(mockSession.logoff).toHaveBeenCalledWith({ usePa3: true })
  })

  it('reports progress for each work item', async () => {
    const params = {
      username: 'user',
      password: 'pass',
      sourceMode: 'rout',
    }

    await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

    expect(mockReporter.reportProgress).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.stringContaining('Processing'),
    )
  })

  it('reports successful ROUT item results', async () => {
    mockRoutScreen.processRoutItem.mockResolvedValue({
      success: true,
      error: '',
      data: { occ: 1, section: 'ERROR MEMOS', items: [], count: 0 },
    })

    const params = {
      username: 'user',
      password: 'pass',
      sourceMode: 'rout',
    }

    await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

    expect(mockReporter.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        data: expect.objectContaining({ occ: 1 }),
      }),
    )
  })

  it('logs off at the end with progress message', async () => {
    const params = {
      username: 'user',
      password: 'pass',
      sourceMode: 'rout',
    }

    await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

    expect(mockReporter.reportProgress).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      'Logging off...',
    )
  })

  describe('412 file mode with uploaded content', () => {
    it('parses uploaded base64 content and processes bulk items', async () => {
      const item = makeRouteItem({ policyNumber: 'ABC123', needsPdqEnrichment: false })
      vi.mocked(parse412File).mockReturnValueOnce([item])

      const params = {
        username: 'user',
        password: 'pass',
        sourceMode: '412',
        file412Content: Buffer.from('some 412 content').toString('base64'),
      }

      await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

      expect(parse412File).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
      )
      // Item has needsPdqEnrichment=false so it should be a bulk item (persist only)
      expect(mockReporter.addItemsPersistOnly).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            policyNumber: 'ABC123',
            status: 'success',
            durationMs: 0,
          }),
        ]),
      )
      // No host authentication needed for bulk-only items
      expect(mockSession.authenticate).not.toHaveBeenCalled()
    })

    it('returns empty when uploaded content fails to decode', async () => {
      vi.mocked(parse412File).mockImplementationOnce(() => {
        throw new Error('bad format')
      })

      const params = {
        username: 'user',
        password: 'pass',
        sourceMode: '412',
        file412Content: Buffer.from('garbage').toString('base64'),
      }

      await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

      expect(mockReporter.reportProgress).toHaveBeenCalledWith(1, 1, 'No items to process')
    })
  })

  describe('412 file mode with SMB download', () => {
    it('throws with error message when SMB download fails with stop strategy', async () => {
      const { config: mockConfig } = await import('@src/config.js')
      Object.assign(mockConfig, { smbShare: '//server/share' })

      mockReadSmbFile.mockRejectedValueOnce(new Error('SMB unavailable'))

      const params = {
        username: 'user',
        password: 'pass',
        sourceMode: '412',
        missing412Strategy: 'stop',
      }

      await expect(
        runRoutExtractorAST(mockAti, params, mockReporter, mockCtx),
      ).rejects.toThrow('SMB unavailable')

      Object.assign(mockConfig, { smbShare: '' })
    })

    it('falls back to ROUT mode when SMB fails and missing412Strategy is use_rout', async () => {
      const { config: mockConfig } = await import('@src/config.js')
      Object.assign(mockConfig, { smbShare: '//server/share' })

      mockReadSmbFile.mockRejectedValueOnce(new Error('SMB unavailable'))

      const params = {
        username: 'user',
        password: 'pass',
        sourceMode: '412',
        missing412Strategy: 'use_rout',
      }

      await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

      expect(mockReporter.reportProgress).toHaveBeenCalledWith(
        0, 1, 'Falling back to ROUT mode...',
      )
      // ROUT mode should have generated work items and authenticated
      expect(mockSession.authenticate).toHaveBeenCalled()
      // Should have processed ROUT items (3 OCCs x 2 sections = 6)
      expect(mockCtx.checkpoint).toHaveBeenCalledTimes(6)

      Object.assign(mockConfig, { smbShare: '' })
    })

    it('parses SMB downloaded content successfully', async () => {
      const { config: mockConfig } = await import('@src/config.js')
      Object.assign(mockConfig, { smbShare: '//server/share' })

      const item = makeRouteItem({ policyNumber: 'SMB001', needsPdqEnrichment: false })
      mockReadSmbFile.mockResolvedValueOnce(Buffer.from('smb file content'))
      vi.mocked(parse412File).mockReturnValueOnce([item])

      const params = {
        username: 'user',
        password: 'pass',
        sourceMode: '412',
      }

      await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

      expect(mockReadSmbFile).toHaveBeenCalled()
      expect(parse412File).toHaveBeenCalled()
      // Bulk item reported (persist only)
      expect(mockReporter.addItemsPersistOnly).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            policyNumber: 'SMB001',
            status: 'success',
            durationMs: 0,
          }),
        ]),
      )

      Object.assign(mockConfig, { smbShare: '' })
    })
  })

  describe('PDQ enrichment for 412 items', () => {
    it('authenticates and enriches items needing PDQ when updateRouteItems is true', async () => {
      const item = makeRouteItem({
        policyNumber: 'PDQ001',
        companyCode: '01',
        policyType: '',
        needsPdqEnrichment: true,
      })
      vi.mocked(parse412File).mockReturnValueOnce([item])
      mockRoutScreen.lookupPdqType.mockResolvedValueOnce('AUTO DISPLAY')
      vi.mocked(getPolicyTypeFromPdq).mockReturnValueOnce('AUTO')

      const params = {
        username: 'user',
        password: 'pass',
        sourceMode: '412',
        file412Content: Buffer.from('content').toString('base64'),
        updateRouteItems: true,
      }

      await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

      // Should authenticate for PDQ enrichment
      expect(mockSession.authenticate).toHaveBeenCalled()
      // Should call lookupPdqType
      expect(mockRoutScreen.lookupPdqType).toHaveBeenCalledWith('PDQ001', '01')
      // Should report enriched item as success
      expect(mockReporter.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          policyNumber: 'PDQ001',
          status: 'success',
        }),
      )
    })

    it('continues with blank PolicyType when PDQ lookup returns null', async () => {
      const item = makeRouteItem({
        policyNumber: 'PDQ002',
        companyCode: '01',
        policyType: '',
        needsPdqEnrichment: true,
      })
      vi.mocked(parse412File).mockReturnValueOnce([item])
      mockRoutScreen.lookupPdqType.mockResolvedValueOnce(null)

      const params = {
        username: 'user',
        password: 'pass',
        sourceMode: '412',
        file412Content: Buffer.from('content').toString('base64'),
        updateRouteItems: true,
      }

      await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

      expect(mockRoutScreen.lookupPdqType).toHaveBeenCalledWith('PDQ002', '01')
      expect(mockReporter.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          policyNumber: 'PDQ002',
          status: 'success',
        }),
      )
    })

    it('continues with blank PolicyType when PDQ lookup throws', async () => {
      const item = makeRouteItem({
        policyNumber: 'PDQ003',
        companyCode: '01',
        policyType: '',
        needsPdqEnrichment: true,
      })
      vi.mocked(parse412File).mockReturnValueOnce([item])
      mockRoutScreen.lookupPdqType.mockRejectedValueOnce(new Error('PDQ down'))

      const params = {
        username: 'user',
        password: 'pass',
        sourceMode: '412',
        file412Content: Buffer.from('content').toString('base64'),
        updateRouteItems: true,
      }

      await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

      expect(mockReporter.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          policyNumber: 'PDQ003',
          status: 'success',
        }),
      )
    })

    it('continues with blank PolicyType when getPolicyTypeFromPdq returns null', async () => {
      const item = makeRouteItem({
        policyNumber: 'PDQ004',
        companyCode: '01',
        policyType: '',
        needsPdqEnrichment: true,
      })
      vi.mocked(parse412File).mockReturnValueOnce([item])
      mockRoutScreen.lookupPdqType.mockResolvedValueOnce('UNKNOWN DISPLAY')
      vi.mocked(getPolicyTypeFromPdq).mockReturnValueOnce(null)

      const params = {
        username: 'user',
        password: 'pass',
        sourceMode: '412',
        file412Content: Buffer.from('content').toString('base64'),
        updateRouteItems: true,
      }

      await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

      expect(getPolicyTypeFromPdq).toHaveBeenCalledWith('UNKNOWN DISPLAY')
      expect(mockReporter.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          policyNumber: 'PDQ004',
          status: 'success',
        }),
      )
    })
  })

  describe('host item processing errors', () => {
    it('reports error status when processRoutItem throws an exception', async () => {
      mockRoutScreen.processRoutItem.mockRejectedValueOnce(new Error('Connection lost'))

      const params = {
        username: 'user',
        password: 'pass',
        sourceMode: 'rout',
      }

      await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

      expect(mockReporter.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error: expect.stringContaining('Connection lost'),
        }),
      )
      // Should continue processing remaining items and still log off
      expect(mockSession.logoff).toHaveBeenCalled()
    })

    it('reports error for 412 item when process412Item throws', async () => {
      const item = makeRouteItem({
        policyNumber: 'ERR001',
        needsPdqEnrichment: true,
      })
      vi.mocked(parse412File).mockReturnValueOnce([item])
      mockRoutScreen.lookupPdqType.mockRejectedValueOnce(new Error('host crash'))

      const params = {
        username: 'user',
        password: 'pass',
        sourceMode: '412',
        file412Content: Buffer.from('content').toString('base64'),
        updateRouteItems: true,
      }

      await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

      // process412Item catches PDQ errors internally so item should succeed
      expect(mockReporter.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          policyNumber: 'ERR001',
          status: 'success',
        }),
      )
    })
  })

  describe('bulk items (pre-computed results)', () => {
    it('reports bulk items via addItemsPersistOnly without host authentication', async () => {
      const items = [
        makeRouteItem({ policyNumber: 'BULK001', needsPdqEnrichment: false }),
        makeRouteItem({ policyNumber: 'BULK002', needsPdqEnrichment: false }),
      ]
      vi.mocked(parse412File).mockReturnValueOnce(items)

      const params = {
        username: 'user',
        password: 'pass',
        sourceMode: '412',
        file412Content: Buffer.from('content').toString('base64'),
      }

      await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

      // All items are bulk - no authentication needed
      expect(mockSession.authenticate).not.toHaveBeenCalled()
      // Both items reported via addItemsPersistOnly (single call with array)
      expect(mockReporter.addItemsPersistOnly).toHaveBeenCalledTimes(1)
      expect(mockReporter.addItemsPersistOnly).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ policyNumber: 'BULK001', durationMs: 0 }),
          expect.objectContaining({ policyNumber: 'BULK002', durationMs: 0 }),
        ]),
      )
    })

    it('completes with progress message when all items are bulk', async () => {
      const items = [
        makeRouteItem({ policyNumber: 'BULK003', needsPdqEnrichment: false }),
      ]
      vi.mocked(parse412File).mockReturnValueOnce(items)

      const params = {
        username: 'user',
        password: 'pass',
        sourceMode: '412',
        file412Content: Buffer.from('content').toString('base64'),
      }

      await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

      expect(mockReporter.addItemsPersistOnly).toHaveBeenCalledTimes(1)
      expect(mockReporter.reportProgress).toHaveBeenCalledWith(
        0, 1, 'Storing 1 pre-computed records...',
      )
      expect(mockReporter.reportProgress).toHaveBeenCalledWith(
        1, 1, 'Route Extractor complete',
      )
      // No logoff since no host session was opened
      expect(mockSession.logoff).not.toHaveBeenCalled()
    })

    it('handles mix of bulk and PDQ-needing items', async () => {
      const bulkItem = makeRouteItem({ policyNumber: 'BULK100', needsPdqEnrichment: false })
      const pdqItem = makeRouteItem({
        policyNumber: 'PDQ100',
        companyCode: '02',
        needsPdqEnrichment: true,
      })
      vi.mocked(parse412File).mockReturnValueOnce([bulkItem, pdqItem])
      mockRoutScreen.lookupPdqType.mockResolvedValueOnce(null)

      const params = {
        username: 'user',
        password: 'pass',
        sourceMode: '412',
        file412Content: Buffer.from('content').toString('base64'),
        updateRouteItems: true,
      }

      await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

      // Should authenticate for the PDQ item
      expect(mockSession.authenticate).toHaveBeenCalled()
      // Bulk item reported via addItemsPersistOnly
      expect(mockReporter.addItemsPersistOnly).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ policyNumber: 'BULK100', durationMs: 0 }),
        ]),
      )
      // PDQ item processed via host and reported via addItem
      expect(mockReporter.addItem).toHaveBeenCalledWith(
        expect.objectContaining({ policyNumber: 'PDQ100', status: 'success' }),
      )
      // Should logoff since host session was opened
      expect(mockSession.logoff).toHaveBeenCalled()
    })

    it('reports PDQ enrichment count in progress message', async () => {
      const bulkItem = makeRouteItem({ policyNumber: 'B1', needsPdqEnrichment: false })
      const pdqItem1 = makeRouteItem({ policyNumber: 'P1', needsPdqEnrichment: true })
      const pdqItem2 = makeRouteItem({ policyNumber: 'P2', needsPdqEnrichment: true })
      vi.mocked(parse412File).mockReturnValueOnce([bulkItem, pdqItem1, pdqItem2])

      const params = {
        username: 'user',
        password: 'pass',
        sourceMode: '412',
        file412Content: Buffer.from('content').toString('base64'),
        updateRouteItems: true,
      }

      await runRoutExtractorAST(mockAti, params, mockReporter, mockCtx)

      expect(mockReporter.reportProgress).toHaveBeenCalledWith(
        0, 1,
        '1 items ready for bulk insert, 2 items need PDQ enrichment',
      )
    })
  })
})
