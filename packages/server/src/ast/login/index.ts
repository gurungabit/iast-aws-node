import type { Ati } from 'tnz3270-node'
import type { ProgressReporter } from '../progress.js'
import type { ASTContext } from '../executor.js'
import { randomUUID } from 'crypto'
import { Session } from '../session.js'

function validatePolicyNumber(policyNumber: string): boolean {
  return Boolean(policyNumber && policyNumber.length === 9 && /^[a-zA-Z0-9]+$/.test(policyNumber))
}

export async function runLoginAST(
  ati: Ati,
  params: Record<string, unknown>,
  reporter: ProgressReporter,
  ctx: ASTContext,
) {
  const session = new Session(ati)
  const username = params.username as string
  const password = params.password as string
  const policyNumbers = (params.policyNumbers ?? params.items ?? []) as string[]

  if (!username || !password) {
    throw new Error('Username and password are required')
  }

  // Phase 1: Authenticate
  reporter.reportProgress(0, policyNumbers.length || 1, 'Logging in...')

  const auth = await session.authenticate({
    username,
    password,
    expectedKeywords: ['Fire System Selection'],
    application: 'FIRE06',
    group: '@OOFIRE',
  })

  if (!auth.success) {
    throw new Error(`Login failed: ${auth.error}`)
  }

  // Phase 2: Process policies
  if (policyNumbers.length === 0) {
    reporter.reportProgress(1, 1, 'No policies to process')
  }

  const isResuming = ctx.completedPolicies.size > 0
  let skippedCount = 0

  for (let i = 0; i < policyNumbers.length; i++) {
    await ctx.checkpoint()

    const policyNumber = policyNumbers[i]

    // Skip already-completed policies on resume
    if (ctx.completedPolicies.has(policyNumber)) {
      skippedCount++
      continue
    }

    if (isResuming && skippedCount > 0 && i === skippedCount) {
      reporter.reportProgress(
        i + 1,
        policyNumbers.length,
        `Resuming: skipped ${skippedCount} already-completed items`,
      )
    }

    const startTime = Date.now()

    reporter.reportProgress(i + 1, policyNumbers.length, `Processing ${policyNumber}`)

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

      // Process the policy (placeholder - actual screen navigation is domain-specific)
      const durationMs = Date.now() - startTime
      reporter.addItem({
        id: randomUUID(),
        policyNumber,
        status: 'success',
        durationMs,
        data: { policyNumber, status: 'active' },
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

  // Phase 3: Logoff
  reporter.reportProgress(policyNumbers.length, policyNumbers.length, 'Logging off...')
  await session.logoff()
}
