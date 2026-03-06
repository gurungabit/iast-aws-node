import { Ati } from 'tnz3270-node'
import type { ProgressReporter } from './progress.js'
import type { ASTContext } from './executor.js'
import { randomUUID } from 'crypto'

// Session wrapper from tnz3270-node ui/session.ts pattern
class Session {
  private ati: Ati
  private defaultTimeout = 10

  constructor(ati: Ati) {
    this.ati = ati
  }

  async enter(text?: string) {
    if (text) await this.ati.send(`${text}[enter]`)
    else await this.ati.send('[enter]')
  }
  async clear() { await this.ati.send('[clear]') }
  async tab() { await this.ati.send('[tab]') }
  async pf(n: number) { await this.ati.send(`[pf${n}]`) }

  async type(text: string) { await this.ati.send(text) }
  async typeAt(row: number, col: number, text: string) {
    await this.ati.send(text, [row, col])
  }

  async waitForText(text: string, timeout?: number) {
    const rc = await this.ati.wait(timeout ?? this.defaultTimeout, () => this.ati.scrhas(text))
    if (rc === 0) throw new Error(`Timeout waiting for "${text}"`)
  }

  async waitForTextGone(text: string, timeout?: number) {
    const rc = await this.ati.wait(timeout ?? this.defaultTimeout, () => !this.ati.scrhas(text))
    if (rc === 0) throw new Error(`Timeout waiting for "${text}" to disappear`)
  }

  async waitForKeyboard(timeout?: number) {
    const rc = await this.ati.wait(timeout ?? this.defaultTimeout, () => !this.ati.keyLock)
    if (rc === 0) throw new Error('Timeout waiting for keyboard unlock')
  }

  hasText(text: string) { return this.ati.scrhas(text) }
  getTextAt(row: number, col: number, length: number) { return this.ati.extract(length, row, col) }
  getRow(row: number) { return this.ati.extract(this.cols, row, 1) }
  get rows() { return this.ati.maxRow }
  get cols() { return this.ati.maxCol }
}

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

  // Phase 1: Login
  reporter.reportProgress(0, policyNumbers.length || 1, 'Logging in...')

  // Wait for signon screen
  await session.waitForText('SIGNON', 30)

  // Enter credentials
  await session.typeAt(6, 22, username)
  await session.typeAt(7, 22, password)
  await session.enter()

  // Wait for main menu or Fire System Selection
  await session.waitForText('Fire System Selection', 30)

  // Select FIRE06 application
  await session.typeAt(21, 18, 'FIRE06')
  await session.enter()

  // Wait for group selection
  await session.waitForText('Select', 15)

  // Phase 2: Process policies
  if (policyNumbers.length === 0) {
    reporter.reportProgress(1, 1, 'No policies to process')
  }

  for (let i = 0; i < policyNumbers.length; i++) {
    await ctx.checkpoint()

    const policyNumber = policyNumbers[i]
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
      // Navigate to policy inquiry
      await session.waitForKeyboard(5)
      // TODO: Implement actual policy processing navigation
      // This is a placeholder - real logic depends on the specific host system

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
  await logoff(session)
}

async function logoff(session: Session) {
  let maxBackoff = 20
  while (!session.hasText('Exit Menu') && maxBackoff > 0) {
    await session.pf(15)
    try {
      await session.waitForText('Exit Menu', 0.8)
      break
    } catch {
      maxBackoff--
    }
  }

  await session.typeAt(36, 5, '1')
  await session.enter()

  try {
    await session.waitForText('SIGNON', 10)
  } catch {
    // Best effort logoff
  }
}
