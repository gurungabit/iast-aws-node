import type { Tnz } from 'tnz3270-node'

const colorMap: Record<number, string> = {
  0xf1: '34',
  0xf2: '31',
  0xf3: '35',
  0xf4: '32',
  0xf5: '36',
  0xf6: '33',
  0xf7: '37',
  0xf8: '90',
  0xf9: '94',
  0xfa: '33',
  0xfb: '95',
  0xfc: '92',
  0xfd: '96',
  0xfe: '37',
  0xff: '97',
}

const MIN_FIELD_UNDERLINE = 6

export function renderAnsiScreen(tnz: Tnz): string {
  let out = '\x1B[H'
  const fullText = tnz.scrstr(0, 0, false)
  const bufSize = tnz.bufferSize

  // Pre-compute underline mask for unprotected fields
  const underline = new Uint8Array(bufSize)
  for (const [faddr, fattr] of tnz.fields()) {
    const isProtected = (fattr & 0x20) !== 0
    const isHidden = (fattr & 0x0c) === 0x0c
    if (isProtected || isHidden) continue

    const dataStart = (faddr + 1) % bufSize
    const [nextFa] = tnz.nextField(dataStart)
    const dataEnd = nextFa >= 0 ? nextFa : dataStart

    const fieldLen = dataEnd >= dataStart ? dataEnd - dataStart : bufSize - dataStart + dataEnd
    if (fieldLen === 0) continue

    let lastContent = -1
    for (let j = 0; j < fieldLen; j++) {
      const pos = (dataStart + j) % bufSize
      if (fullText[pos] !== ' ') lastContent = j
    }

    const underlineEnd = Math.min(Math.max(lastContent + 2, MIN_FIELD_UNDERLINE), fieldLen)
    for (let j = 0; j < underlineEnd; j++) {
      underline[(dataStart + j) % bufSize] = 1
    }
  }

  for (let i = 0; i < bufSize; i++) {
    if (i > 0 && i % tnz.maxCol === 0) out += '\x1B[0m\r\n'

    const isFa = tnz.planeFa[i] !== 0
    const [, fattr] = tnz._field(i)
    const isHidden = (fattr & 0x0c) === 0x0c
    const isIntensified = (fattr & 0x08) === 0x08 && !isHidden

    let char = isFa ? ' ' : fullText[i]
    if (isHidden) {
      const dc = tnz.planeDc[i]
      char = !isFa && dc !== 0 && dc !== 0x40 ? '*' : ' '
    }

    const fg = tnz.planeFg[i]
    const eh = tnz.planeEh[i]

    const codes = []
    if (isIntensified) codes.push('1')
    if (fg && colorMap[fg]) {
      codes.push(colorMap[fg])
    } else {
      const isProtectedField = (fattr & 0x20) !== 0
      if (isProtectedField) {
        codes.push(isIntensified ? '97' : '94')
      } else {
        codes.push(isIntensified ? '97' : '36')
      }
    }

    if (eh === 0xf1) codes.push('5')
    if (eh === 0xf2) codes.push('7')
    if (underline[i]) codes.push('4')
    else if (eh === 0xf4 && char !== ' ') codes.push('4')

    const format = `\x1B[0;${codes.join(';')}m`
    out += `${format}${char}`
  }
  out += '\x1B[0m'

  const curRow = Math.floor(tnz.curadd / tnz.maxCol) + 1
  const curCol = (tnz.curadd % tnz.maxCol) + 1
  out += `\x1B[${curRow};${curCol}H`

  return out
}
