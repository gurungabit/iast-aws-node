/**
 * NTLM authentication for SMB2.
 * NTLMv1 implementation matching github.com/awo00/smb2 reference.
 * Uses DES-based LM/NT hashes with minimal flags.
 */

import md4 from 'js-md4'
import desjs from 'des.js'

const NTLMSSP_SIGNATURE = Buffer.from('NTLMSSP\0')

// Minimal flags — exactly matching reference library
const FLAGS =
  0x00000001 | // NEGOTIATE_UNICODE
  0x00000200 | // NEGOTIATE_NTLM
  0x00008000   // NEGOTIATE_ALWAYS_SIGN

/** Create NTLM Type 1 (Negotiate) message — 32 bytes */
export function createType1(): Buffer {
  const buf = Buffer.alloc(32)
  NTLMSSP_SIGNATURE.copy(buf, 0)
  buf.writeUInt32LE(1, 8)
  buf.writeUInt32LE(FLAGS, 12)
  // Domain and workstation fields left empty (offset 16-31)
  return buf
}

/** Parse NTLM Type 2 — extract 8-byte server challenge */
export function parseType2(buf: Buffer): Buffer {
  if (!buf.subarray(0, 8).equals(NTLMSSP_SIGNATURE)) {
    throw new Error('Invalid NTLMSSP signature in Type 2')
  }
  if (buf.readUInt32LE(8) !== 2) throw new Error('Not a Type 2 message')
  return Buffer.from(buf.subarray(24, 32))
}

/** Create NTLM Type 3 (Authenticate) — NTLMv1, 64-byte header */
export function createType3(
  _type1: Buffer,
  type2: Buffer,
  username: string,
  password: string,
  domain: string,
  hostname: string,
): Buffer {
  const serverChallenge = parseType2(type2)

  hostname = hostname.toUpperCase()
  domain = domain.toUpperCase()

  // NTLMv1 hashes (16 bytes each, padded to 21 with zeros)
  const lmHash = Buffer.alloc(21)
  createLmHash(password).copy(lmHash)

  const ntHash = Buffer.alloc(21)
  createNtHash(password).copy(ntHash)

  // 24-byte DES responses
  const lmResponse = createResponse(lmHash, serverChallenge)
  const ntResponse = createResponse(ntHash, serverChallenge)

  const domainBuf = Buffer.from(domain, 'ucs2')
  const userBuf = Buffer.from(username, 'ucs2')
  const hostBuf = Buffer.from(hostname, 'ucs2')

  const lmLen = lmResponse.length   // 24
  const ntLen = ntResponse.length   // 24

  // Payload offsets (after 64-byte header)
  const domainOffset = 0x40
  const userOffset = domainOffset + domainBuf.length
  const hostOffset = userOffset + userBuf.length
  const lmOffset = hostOffset + hostBuf.length
  const ntOffset = lmOffset + lmLen

  const messageLength = ntOffset + ntLen
  const buf = Buffer.alloc(messageLength)

  // Signature + Type
  NTLMSSP_SIGNATURE.copy(buf, 0)
  buf.writeUInt8(0x03, 8) // Type 3

  let offset = 12

  // LM response fields
  buf.writeUInt16LE(lmLen, offset); offset += 2
  buf.writeUInt16LE(lmLen, offset); offset += 2
  buf.writeUInt16LE(lmOffset, offset); offset += 2
  buf.fill(0x00, offset, offset + 2); offset += 2

  // NT response fields
  buf.writeUInt16LE(ntLen, offset); offset += 2
  buf.writeUInt16LE(ntLen, offset); offset += 2
  buf.writeUInt16LE(ntOffset, offset); offset += 2
  buf.fill(0x00, offset, offset + 2); offset += 2

  // Domain fields
  buf.writeUInt16LE(domainBuf.length, offset); offset += 2
  buf.writeUInt16LE(domainBuf.length, offset); offset += 2
  buf.writeUInt16LE(domainOffset, offset); offset += 2
  buf.fill(0x00, offset, offset + 2); offset += 2

  // Username fields
  buf.writeUInt16LE(userBuf.length, offset); offset += 2
  buf.writeUInt16LE(userBuf.length, offset); offset += 2
  buf.writeUInt16LE(userOffset, offset); offset += 2
  buf.fill(0x00, offset, offset + 2); offset += 2

  // Workstation fields
  buf.writeUInt16LE(hostBuf.length, offset); offset += 2
  buf.writeUInt16LE(hostBuf.length, offset); offset += 2
  buf.writeUInt16LE(hostOffset, offset); offset += 2
  buf.fill(0x00, offset, offset + 6); offset += 6

  // Message length (at encrypted session key offset, matching reference)
  buf.writeUInt16LE(messageLength, offset); offset += 2
  buf.fill(0x00, offset, offset + 2); offset += 2

  // Negotiate flags
  buf.writeUInt32LE(FLAGS, offset); offset += 4

  // Copy payloads
  domainBuf.copy(buf, domainOffset)
  userBuf.copy(buf, userOffset)
  hostBuf.copy(buf, hostOffset)
  lmResponse.copy(buf, lmOffset)
  ntResponse.copy(buf, ntOffset)

  console.log(`[NTLM] Type3: ${buf.length}b, flags=0x${FLAGS.toString(16)}, domain="${domain}", host="${hostname}", lm=${lmLen}b, nt=${ntLen}b`)
  return buf
}

/** Extract NTLM token from a buffer that may be raw NTLM or SPNEGO-wrapped */
export function extractNtlmToken(buf: Buffer): Buffer {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(NTLMSSP_SIGNATURE)) {
    return buf
  }
  const idx = buf.indexOf(NTLMSSP_SIGNATURE)
  if (idx === -1) {
    throw new Error('NTLMSSP token not found in response')
  }
  return Buffer.from(buf.subarray(idx))
}

// --- SPNEGO / GSS-API wrapping ---

/** Wrap NTLM Type 1 in SPNEGO NegTokenInit */
export function wrapSpnego(ntlmToken: Buffer): Buffer {
  const mechType = Buffer.from([
    0x06, 0x0a, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x82, 0x37, 0x02, 0x02, 0x0a,
  ]) // OID 1.3.6.1.4.1.311.2.2.10 (NTLMSSP)

  // mechTypes [0] MechTypeList (SEQUENCE OF OID)
  const mechTypes = asn1Wrap(0xa0, asn1Wrap(0x30, mechType))
  // mechToken [2] OCTET STRING
  const mechTokenField = asn1Wrap(0xa2, asn1Wrap(0x04, ntlmToken))
  // NegTokenInit SEQUENCE
  const negTokenInit = asn1Wrap(0x30, Buffer.concat([mechTypes, mechTokenField]))
  // [0] explicit tag
  const contextTag = asn1Wrap(0xa0, negTokenInit)
  // Application [0] with SPNEGO OID
  const spnegoOid = Buffer.from([0x06, 0x06, 0x2b, 0x06, 0x01, 0x05, 0x05, 0x02])
  return asn1Wrap(0x60, Buffer.concat([spnegoOid, contextTag]))
}

/** Wrap NTLM Type 3 in SPNEGO NegTokenResp */
export function wrapSpnegoAuth(ntlmToken: Buffer): Buffer {
  const mechTokenWrapped = asn1Wrap(0xa2, asn1Wrap(0x04, ntlmToken))
  return asn1Wrap(0xa1, asn1Wrap(0x30, mechTokenWrapped))
}

function asn1Wrap(tag: number, data: Buffer): Buffer {
  const len = data.length
  let header: Buffer
  if (len < 128) {
    header = Buffer.from([tag, len])
  } else if (len < 256) {
    header = Buffer.from([tag, 0x81, len])
  } else if (len < 65536) {
    header = Buffer.alloc(4)
    header[0] = tag
    header[1] = 0x82
    header.writeUInt16BE(len, 2)
  } else {
    header = Buffer.alloc(5)
    header[0] = tag
    header[1] = 0x83
    header[2] = (len >> 16) & 0xff
    header.writeUInt16BE(len & 0xffff, 3)
  }
  return Buffer.concat([header, data])
}

// --- NTLMv1 DES-based hash functions (matching reference) ---

/** Expand 7-byte key to 8-byte DES key by inserting zeros every 7 bits */
function expandDESKey(key7: Buffer): Buffer {
  const hex2binary: Record<string, number[]> = {
    '0': [0,0,0,0], '1': [0,0,0,1], '2': [0,0,1,0], '3': [0,0,1,1],
    '4': [0,1,0,0], '5': [0,1,0,1], '6': [0,1,1,0], '7': [0,1,1,1],
    '8': [1,0,0,0], '9': [1,0,0,1], 'A': [1,0,1,0], 'B': [1,0,1,1],
    'C': [1,1,0,0], 'D': [1,1,0,1], 'E': [1,1,1,0], 'F': [1,1,1,1],
  }
  const binary2hex: Record<string, string> = {
    '0000': '0', '0001': '1', '0010': '2', '0011': '3',
    '0100': '4', '0101': '5', '0110': '6', '0111': '7',
    '1000': '8', '1001': '9', '1010': 'A', '1011': 'B',
    '1100': 'C', '1101': 'D', '1110': 'E', '1111': 'F',
  }

  // Convert to binary array
  const hexStr = key7.toString('hex').toUpperCase()
  let bits: number[] = []
  for (let i = 0; i < hexStr.length; i++) {
    bits = bits.concat(hex2binary[hexStr[i]])
  }

  // Insert 0 after every 7 bits
  const newBits: number[] = []
  for (let i = 0; i < bits.length; i++) {
    newBits.push(bits[i])
    if ((i + 1) % 7 === 0) newBits.push(0)
  }

  // Convert back to bytes
  const bufs: Buffer[] = []
  for (let i = 0; i < newBits.length; i += 8) {
    if (i + 7 > newBits.length) break
    const b1 = '' + newBits[i] + newBits[i+1] + newBits[i+2] + newBits[i+3]
    const b2 = '' + newBits[i+4] + newBits[i+5] + newBits[i+6] + newBits[i+7]
    bufs.push(Buffer.from(binary2hex[b1] + binary2hex[b2], 'hex'))
  }
  return Buffer.concat(bufs)
}

/** DES-ECB encrypt using des.js */
function desEncrypt(key7: Buffer, data: Buffer): Buffer {
  const key8 = expandDESKey(key7)
  const cipher = desjs.DES.create({ type: 'encrypt', key: key8 })
  return Buffer.from(cipher.update(data))
}

/** LM hash: DES-encrypt magic string with password-derived keys */
function createLmHash(password: string): Buffer {
  const pwd = password.toUpperCase()
  const pwdBuf = Buffer.alloc(14)
  const src = Buffer.from(pwd, 'ascii')
  src.copy(pwdBuf, 0, 0, Math.min(src.length, 14))

  const magic = Buffer.from('KGS!@#$%', 'ascii')
  return Buffer.concat([
    desEncrypt(pwdBuf.subarray(0, 7), magic),
    desEncrypt(pwdBuf.subarray(7, 14), magic),
  ])
}

/** NT hash: MD4 of UTF-16LE password */
function createNtHash(password: string): Buffer {
  return Buffer.from(md4.arrayBuffer(Buffer.from(password, 'utf16le')))
}

/** Create 24-byte DES response from 21-byte hash and 8-byte challenge */
function createResponse(hash21: Buffer, challenge: Buffer): Buffer {
  return Buffer.concat([
    desEncrypt(hash21.subarray(0, 7), challenge),
    desEncrypt(hash21.subarray(7, 14), challenge),
    desEncrypt(hash21.subarray(14, 21), challenge),
  ])
}
