import type { Ati } from 'tnz3270-node'
import type { ProgressReporter } from './progress.js'
import type { ASTContext } from './executor.js'
import { randomUUID } from 'crypto'

export async function runRoutExtractorAST(
  ati: Ati,
  params: Record<string, unknown>,
  reporter: ProgressReporter,
  ctx: ASTContext,
) {
  const username = params.username as string
  const password = params.password as string
  const policyNumbers = (params.policyNumbers ?? params.items ?? []) as string[]

  if (!username || !password) {
    throw new Error('Username and password are required')
  }

  reporter.reportProgress(0, policyNumbers.length || 1, 'Starting Route Extractor...')

  // TODO: Port from Python rout_extractor AST
  // 1. Login to host system
  // 2. Navigate to ROUT data inquiry screens
  // 3. Extract route data for each policy
  // 4. Logoff

  for (let i = 0; i < policyNumbers.length; i++) {
    await ctx.checkpoint()

    const policyNumber = policyNumbers[i]
    const startTime = Date.now()

    reporter.reportProgress(i + 1, policyNumbers.length, `Extracting ${policyNumber}`)

    try {
      // TODO: Implement route data extraction
      const durationMs = Date.now() - startTime
      reporter.addItem({
        id: randomUUID(),
        policyNumber,
        status: 'success',
        durationMs,
        data: { policyNumber },
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

  reporter.reportProgress(policyNumbers.length, policyNumbers.length, 'Route Extractor complete')
}
