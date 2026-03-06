import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import md4 from 'js-md4'

describe('NTLMv2 verification against MS-NLMP test vectors', () => {
  it('js-md4 produces correct MD4 hash for empty input', () => {
    const hash = Buffer.from(md4.arrayBuffer(new Uint8Array(0)))
    expect(hash.toString('hex')).toBe('31d6cfe0d16ae931b73c59d7e0c089c0')
  })

  it('js-md4 produces correct NT hash for "Password"', () => {
    // MS-NLMP Section 4.2.4.1.1
    const passUtf16 = Buffer.from('Password', 'utf16le')
    const ntHash = Buffer.from(md4.arrayBuffer(passUtf16))
    expect(ntHash.toString('hex')).toBe('a4f49c406510bdcab6824ee7c30fd852')
  })

  it('NTOWFv2 produces correct response key', () => {
    // MS-NLMP Section 4.2.4.1.1
    // User="User", UserDom="Domain", Password="Password"
    const passUtf16 = Buffer.from('Password', 'utf16le')
    const ntHash = Buffer.from(md4.arrayBuffer(passUtf16))

    // Identity = UPPER("User") + "Domain" = "USERDomain"
    const identity = Buffer.from('USERDomain', 'utf16le')
    const responseKeyNT = createHmac('md5', ntHash).update(identity).digest()

    // Expected NTOWFv2 from MS-NLMP 4.2.4.1.1
    expect(responseKeyNT.toString('hex')).toBe('0c868a403bfd7a93a3001ef22ef02e3f')
  })
})
