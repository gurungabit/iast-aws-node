import type { Ati } from 'tnz3270-node'

/**
 * High-level Session wrapper over tnz3270-node Ati.
 * Provides named methods matching the Python Host class API.
 * All row/col parameters are 1-based (matching Python convention).
 */
export class Session {
  private ati: Ati
  private defaultTimeout = 10

  constructor(ati: Ati) {
    this.ati = ati
  }

  // -- Key actions --

  async enter(text?: string) {
    if (text) await this.ati.send(`${text}[enter]`)
    else await this.ati.send('[enter]')
  }

  async clear() {
    await this.ati.send('[clear]')
  }

  async tab() {
    await this.ati.send('[tab]')
  }

  async backtab() {
    await this.ati.send('[backtab]')
  }

  async pf(n: number) {
    await this.ati.send(`[pf${n}]`)
  }

  async pa(n: number) {
    await this.ati.send(`[pa${n}]`)
  }

  // -- Text input --

  async type(text: string) {
    await this.ati.send(text)
  }

  /** Fill field at 1-based row/col position */
  async fillFieldAtPosition(row: number, col: number, text: string) {
    await this.ati.send(text, [row, col])
  }

  /** Search screen for a label and fill the adjacent input field */
  async fillFieldByLabel(label: string, value: string, caseInsensitive = true): Promise<boolean> {
    const screenText = this.getFullScreen()
    const searchLabel = caseInsensitive ? label.toLowerCase() : label
    const searchScreen = caseInsensitive ? screenText.toLowerCase() : screenText

    const idx = searchScreen.indexOf(searchLabel)
    if (idx === -1) return false

    // Calculate the row/col position of the label
    const cols = this.cols
    const labelRow = Math.floor(idx / cols) + 1
    const labelEndCol = (idx % cols) + label.length + 1

    // Try to position cursor after the label and type
    // The field is typically right after the label on the same row
    await this.fillFieldAtPosition(labelRow, labelEndCol + 1, value)
    return true
  }

  // -- Waiting --

  /** Case-insensitive screen search (matches Python's default behavior) */
  private screenHas(text: string, caseSensitive = false): boolean {
    if (caseSensitive) return this.ati.scrhas(text)
    return this.getFullScreen().toLowerCase().includes(text.toLowerCase())
  }

  async waitForText(text: string, timeout?: number, caseSensitive = false): Promise<boolean> {
    const t = timeout ?? this.defaultTimeout
    const rc = await this.ati.wait(t, () => this.screenHas(text, caseSensitive))
    return rc !== 0
  }

  async waitForTextOrThrow(text: string, timeout?: number) {
    if (!(await this.waitForText(text, timeout))) {
      throw new Error(`Timeout waiting for "${text}"`)
    }
  }

  async waitForTextGone(text: string, timeout?: number, caseSensitive = false): Promise<boolean> {
    const t = timeout ?? this.defaultTimeout
    const rc = await this.ati.wait(t, () => !this.screenHas(text, caseSensitive))
    return rc !== 0
  }

  async waitForKeyboard(timeout?: number): Promise<boolean> {
    const t = timeout ?? this.defaultTimeout
    const rc = await this.ati.wait(t, () => !this.ati.keyLock)
    return rc !== 0
  }

  /** Wait for any of multiple texts to appear. Returns the matched text or null. */
  async waitForAnyText(texts: string[], timeout?: number, caseSensitive = false): Promise<string | null> {
    const t = timeout ?? this.defaultTimeout
    let matched: string | null = null
    await this.ati.wait(t, () => {
      for (const text of texts) {
        if (this.screenHas(text, caseSensitive)) {
          matched = text
          return true
        }
      }
      return false
    })
    return matched
  }

  // -- Screen reading --

  hasText(text: string, caseSensitive = false): boolean {
    return this.screenHas(text, caseSensitive)
  }

  screenContains(text: string, caseSensitive = false): boolean {
    return this.screenHas(text, caseSensitive)
  }

  /** Get text at 1-based row/col position */
  getTextAt(row: number, col: number, length: number): string {
    return this.ati.extract(length, row, col)
  }

  getRow(row: number): string {
    return this.ati.extract(this.cols, row, 1)
  }

  getFullScreen(): string {
    const lines: string[] = []
    for (let r = 1; r <= this.rows; r++) {
      lines.push(this.getRow(r))
    }
    return lines.join('')
  }

  get rows(): number {
    return this.ati.maxRow
  }

  get cols(): number {
    return this.ati.maxCol
  }

  // -- Authentication (ported from Python AST base class) --

  async authenticate(config: {
    username: string
    password: string
    expectedKeywords: string[]
    application?: string
    group?: string
  }): Promise<{ success: boolean; error: string }> {
    const { username, password, expectedKeywords, application, group } = config

    // Check if already at expected post-login screen
    for (const keyword of expectedKeywords) {
      if (this.screenContains(keyword)) {
        return { success: true, error: '' }
      }
    }

    try {
      // Fill credentials by label
      if (!(await this.fillFieldByLabel('Userid', username))) {
        return { success: false, error: 'Failed to find Userid field' }
      }

      if (!(await this.fillFieldByLabel('Password', password))) {
        return { success: false, error: 'Failed to find Password field' }
      }

      if (application) {
        await this.fillFieldByLabel('Application', application)
      }

      if (group) {
        await this.fillFieldByLabel('Group', group)
      }

      await this.enter()

      // Verify we reached expected screen
      for (const keyword of expectedKeywords) {
        if (await this.waitForText(keyword, 30)) {
          return { success: true, error: '' }
        }
      }

      return {
        success: false,
        error: `Expected keywords not found: ${expectedKeywords.join(', ')}`,
      }
    } catch (err) {
      return { success: false, error: `Authentication error: ${err}` }
    }
  }

  // -- Logoff (common pattern across ASTs) --

  async logoff(options?: {
    usePa3?: boolean
    targetKeywords?: string[]
  }): Promise<{ success: boolean; error: string }> {
    const { usePa3 = false, targetKeywords = ['**** SIGNON ****', 'SIGNON'] } = options ?? {}

    if (usePa3) {
      await this.pa(3)
    }

    let maxBackoff = 20
    while (maxBackoff > 0) {
      if (await this.waitForText('Exit Menu', 0.8)) break
      await this.pf(15)
      maxBackoff--
    }

    await this.fillFieldAtPosition(36, 5, '1')
    await this.enter()

    for (const keyword of targetKeywords) {
      if (await this.waitForText(keyword, 10)) {
        return { success: true, error: '' }
      }
    }

    return { success: false, error: 'Failed to sign off' }
  }
}
