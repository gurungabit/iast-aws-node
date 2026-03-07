import type { Ati, Tnz } from 'tnz3270-node'

// Field attribute bit flags (3270 architecture)
const FA_PROTECTED = 0x20

interface ScreenField {
  address: number // buffer address of field data start (after FA byte)
  row: number // 0-indexed row
  col: number // 0-indexed col
  length: number
  protected: boolean
}

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

  /** Get the underlying Tnz instance */
  private get tnz(): Tnz | undefined {
    return this.ati.getTnz()
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

  /** Fill field at 1-based row/col position (clears field first, matching Python) */
  async fillFieldAtPosition(row: number, col: number, text: string) {
    const tnz = this.tnz
    if (!tnz) return
    const address = (row - 1) * tnz.maxCol + (col - 1)
    tnz.curadd = address
    tnz.keyEraseEof()
    tnz.keyData(text)
  }

  /** Get all fields on the screen by scanning the field attribute plane */
  private getFields(): ScreenField[] {
    const tnz = this.tnz
    if (!tnz) return []

    const fields: ScreenField[] = []
    const bufSize = tnz.bufferSize
    const maxCol = tnz.maxCol

    // Collect all field attribute positions
    const faPositions: [number, number][] = []
    for (const [addr, fattr] of tnz.fields()) {
      faPositions.push([addr, fattr])
    }

    if (faPositions.length === 0) return fields

    for (let i = 0; i < faPositions.length; i++) {
      const [faAddr, fattr] = faPositions[i]
      const fieldStart = (faAddr + 1) % bufSize
      const fieldEnd = faPositions[(i + 1) % faPositions.length][0]

      const length = fieldEnd > fieldStart ? fieldEnd - fieldStart : bufSize - fieldStart + fieldEnd

      fields.push({
        address: fieldStart,
        row: Math.floor(fieldStart / maxCol),
        col: fieldStart % maxCol,
        length,
        protected: (fattr & FA_PROTECTED) !== 0,
      })
    }

    return fields
  }

  /** Get all unprotected (input) fields */
  private getUnprotectedFields(): ScreenField[] {
    return this.getFields().filter((f) => !f.protected)
  }

  /**
   * Search screen for a label and fill the closest unprotected input field.
   * Uses field-attribute-aware positioning (matching Python Host.fill_field_by_label).
   */
  async fillFieldByLabel(label: string, value: string, caseInsensitive = true): Promise<boolean> {
    const tnz = this.tnz
    if (!tnz) return false

    const inputFields = this.getUnprotectedFields()
    if (inputFields.length === 0) return false

    const maxCol = tnz.maxCol
    const screenText = tnz.scrstr(0, 0, false)
    if (!screenText) return false

    const searchLabel = caseInsensitive ? label.toUpperCase() : label
    const searchScreen = caseInsensitive ? screenText.toUpperCase() : screenText

    const labelPos = searchScreen.indexOf(searchLabel)
    if (labelPos === -1) return false

    const labelRow = Math.floor(labelPos / maxCol)
    const labelEndCol = (labelPos % maxCol) + searchLabel.length

    // Find closest unprotected field after the label (matching Python logic)
    let bestField: ScreenField | null = null
    let minDistance = Infinity

    for (const field of inputFields) {
      if (field.row < labelRow) continue

      const rowDiff = field.row - labelRow

      if (rowDiff === 0) {
        if (field.col >= labelEndCol) {
          const distance = field.col - labelEndCol
          if (distance < minDistance) {
            minDistance = distance
            bestField = field
          }
        }
      } else {
        const distance = rowDiff * 1000 + Math.abs(field.col - (labelPos % maxCol))
        if (distance < minDistance) {
          minDistance = distance
          bestField = field
        }
      }
    }

    if (!bestField) return false

    // Move cursor to field address, clear field, type value
    tnz.curadd = bestField.address
    tnz.keyEraseEof()
    tnz.keyData(value)
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
  async waitForAnyText(
    texts: string[],
    timeout?: number,
    caseSensitive = false,
  ): Promise<string | null> {
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
      if (await this.waitForText('Exit Menu', 0.2)) break
      await this.pf(15)
      maxBackoff--
    }

    await this.fillFieldAtPosition(37, 6, '1')
    await this.enter()

    for (const keyword of targetKeywords) {
      if (await this.waitForText(keyword, 10)) {
        return { success: true, error: '' }
      }
    }

    return { success: false, error: 'Failed to sign off' }
  }
}
