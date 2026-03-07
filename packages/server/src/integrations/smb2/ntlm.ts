/**
 * NTLMv2 authentication with SPNEGO wrapping and MIC support.
 *
 * Implements MS-NLMP (NTLMv2) for servers that:
 *  - Require SPNEGO/GSS-API wrapping (raw NTLM → STATUS_NOT_SUPPORTED)
 *  - Require MIC when TargetInfo contains MsvAvTimestamp (no MIC → STATUS_USER_SESSION_DELETED)
 *
 * Key design decisions:
 *  - No KEY_EXCH: ExportedSessionKey = SessionBaseKey (avoids RC4 which is disabled in OpenSSL 3.x)
 *  - Uses des.js for DES-ECB (also disabled in OpenSSL 3.x)
 *  - Uses js-md4 for MD4 (removed from OpenSSL 3.x)
 *  - Zero-length LM response when MIC is present (per MS-NLMP 3.1.5.1.2)
 *  - MsvAvFlags=0x02 (MIC_PROVIDED) injected into TargetInfo before MsvAvEOL
 */

import { createHmac, randomBytes } from 'crypto'
import md4 from 'js-md4'
import { DES } from 'des.js'

// ── NTLM Negotiate Flags ──

const NTLMSSP_NEGOTIATE_UNICODE = 0x00000001
const NTLMSSP_REQUEST_TARGET = 0x00000004
const NTLMSSP_NEGOTIATE_NTLM = 0x00000200
const NTLMSSP_NEGOTIATE_ALWAYS_SIGN = 0x00008000
const NTLMSSP_NEGOTIATE_EXTENDED_SESSIONSECURITY = 0x00080000
const NTLMSSP_NEGOTIATE_TARGET_INFO = 0x00800000
const NTLMSSP_NEGOTIATE_VERSION = 0x02000000
const NTLMSSP_NEGOTIATE_128 = 0x20000000

// We do NOT set KEY_EXCH (0x40000000) — avoids RC4 requirement
const NEGOTIATE_FLAGS =
  NTLMSSP_NEGOTIATE_UNICODE |
  NTLMSSP_REQUEST_TARGET |
  NTLMSSP_NEGOTIATE_NTLM |
  NTLMSSP_NEGOTIATE_ALWAYS_SIGN |
  NTLMSSP_NEGOTIATE_EXTENDED_SESSIONSECURITY |
  NTLMSSP_NEGOTIATE_TARGET_INFO |
  NTLMSSP_NEGOTIATE_VERSION |
  NTLMSSP_NEGOTIATE_128

// ── AvPair IDs ──

const MsvAvEOL = 0x0000
const MsvAvNbDomainName = 0x0002
const MsvAvTimestamp = 0x0007
const MsvAvFlags = 0x0006

// ── NTLMSSP Signature ──

const NTLMSSP_SIGNATURE = Buffer.from('NTLMSSP\0', 'ascii')

// ── Version block (Windows 10.0.19041, NTLM revision 0x0F) ──

const VERSION = Buffer.from([0x0a, 0x00, 0x63, 0x45, 0x00, 0x00, 0x00, 0x0f])

// ── SPNEGO OIDs ──

const OID_SPNEGO = Buffer.from([0x06, 0x06, 0x2b, 0x06, 0x01, 0x05, 0x05, 0x02])
const OID_NTLMSSP = Buffer.from([
  0x06, 0x0a, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x82, 0x37, 0x02, 0x02, 0x0a,
])

// ═══════════════════════════════════════════════════════════════
// ASN.1 DER helpers
// ═══════════════════════════════════════════════════════════════

function asn1Length(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len])
  if (len < 0x100) return Buffer.from([0x81, len])
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff])
}

function asn1Wrap(tag: number, data: Buffer): Buffer {
  const lenBuf = asn1Length(data.length)
  const result = Buffer.alloc(1 + lenBuf.length + data.length)
  result[0] = tag
  lenBuf.copy(result, 1)
  data.copy(result, 1 + lenBuf.length)
  return result
}

// ═══════════════════════════════════════════════════════════════
// SPNEGO wrapping
// ═══════════════════════════════════════════════════════════════

/** Wrap Type 1 NTLM token in SPNEGO NegTokenInit (GSS-API) */
export function wrapSpnegoInit(ntlmToken: Buffer): Buffer {
  // mechTypes: SEQUENCE { OID_NTLMSSP }
  const mechTypes = asn1Wrap(0x30, OID_NTLMSSP)
  // mechToken: [2] OCTET STRING
  const mechToken = asn1Wrap(0xa2, asn1Wrap(0x04, ntlmToken))
  // NegTokenInit: SEQUENCE { [0] mechTypes, [2] mechToken }
  const negTokenInit = asn1Wrap(0x30, Buffer.concat([asn1Wrap(0xa0, mechTypes), mechToken]))
  // [0] EXPLICIT NegTokenInit
  const innerApp = asn1Wrap(0xa0, negTokenInit)
  // APPLICATION [0] { OID_SPNEGO, [0] NegTokenInit }
  return asn1Wrap(0x60, Buffer.concat([OID_SPNEGO, innerApp]))
}

/** Wrap Type 3 NTLM token in SPNEGO NegTokenResp */
export function wrapSpnegoAuth(ntlmToken: Buffer): Buffer {
  // responseToken: [2] OCTET STRING
  const responseToken = asn1Wrap(0xa2, asn1Wrap(0x04, ntlmToken))
  // NegTokenResp: SEQUENCE { [2] responseToken }
  const negTokenResp = asn1Wrap(0x30, responseToken)
  // [1] EXPLICIT NegTokenResp
  return asn1Wrap(0xa1, negTokenResp)
}

/** Extract raw NTLM token from SPNEGO-wrapped or raw buffer */
export function extractNtlmToken(buf: Buffer): Buffer {
  // If it starts with NTLMSSP signature, it's already raw
  if (buf.length >= 8 && buf.subarray(0, 8).equals(NTLMSSP_SIGNATURE)) {
    return buf
  }

  // Walk ASN.1 to find the NTLMSSP signature inside SPNEGO
  const idx = bufferIndexOf(buf, NTLMSSP_SIGNATURE)
  if (idx === -1) {
    throw new Error('Cannot find NTLMSSP signature in SPNEGO response')
  }
  return buf.subarray(idx)
}

function bufferIndexOf(haystack: Buffer, needle: Buffer): number {
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let match = true
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false
        break
      }
    }
    if (match) return i
  }
  return -1
}

// ═══════════════════════════════════════════════════════════════
// Type 1 (Negotiate)
// ═══════════════════════════════════════════════════════════════

/** Create NTLM Type 1 (Negotiate) message — 40 bytes (32 base + 8 version) */
export function createType1(): Buffer {
  const buf = Buffer.alloc(40)
  NTLMSSP_SIGNATURE.copy(buf, 0)
  buf.writeUInt32LE(1, 8) // MessageType = 1
  buf.writeUInt32LE(NEGOTIATE_FLAGS, 12) // NegotiateFlags
  // DomainNameFields: Len=0, MaxLen=0, Offset=0 (bytes 16-23)
  // WorkstationFields: Len=0, MaxLen=0, Offset=0 (bytes 24-31)
  VERSION.copy(buf, 32) // Version (bytes 32-39)
  return buf
}

// ═══════════════════════════════════════════════════════════════
// Type 2 (Challenge) parsing
// ═══════════════════════════════════════════════════════════════

export interface Type2Info {
  serverChallenge: Buffer
  targetInfo: Buffer // raw TargetInfo AV_PAIRs
  flags: number
  /** The exact Type 2 message bytes (for MIC computation — only the NTLM bytes, no SPNEGO) */
  rawType2: Buffer
}

/** Parse Type 2 message. Input must be raw NTLM (use extractNtlmToken first). */
export function parseType2(raw: Buffer): Type2Info {
  if (!raw.subarray(0, 8).equals(NTLMSSP_SIGNATURE)) {
    throw new Error('Invalid Type 2: missing NTLMSSP signature')
  }
  const msgType = raw.readUInt32LE(8)
  if (msgType !== 2) throw new Error(`Expected Type 2 message, got ${msgType}`)

  const flags = raw.readUInt32LE(20)
  const serverChallenge = Buffer.from(raw.subarray(24, 32))

  // TargetInfo fields at offset 40
  const tiLen = raw.readUInt16LE(40)
  const tiOff = raw.readUInt32LE(44)
  const targetInfo = Buffer.from(raw.subarray(tiOff, tiOff + tiLen))

  // Compute exact Type 2 message size — needed for accurate MIC
  // The Type 2 ends after all payloads. We take the max of (tiOff + tiLen)
  // and the TargetName payload end.
  const tnLen = raw.readUInt16LE(12)
  const tnOff = raw.readUInt32LE(16)
  const payloadEnd = Math.max(tiOff + tiLen, tnOff + tnLen)
  const rawType2 = Buffer.from(raw.subarray(0, payloadEnd))

  return { serverChallenge, targetInfo, flags, rawType2 }
}

// ═══════════════════════════════════════════════════════════════
// TargetInfo processing
// ═══════════════════════════════════════════════════════════════

interface AvPair {
  id: number
  data: Buffer
}

function parseAvPairs(buf: Buffer): AvPair[] {
  const pairs: AvPair[] = []
  let off = 0
  while (off + 4 <= buf.length) {
    const id = buf.readUInt16LE(off)
    const len = buf.readUInt16LE(off + 2)
    if (id === MsvAvEOL) break
    pairs.push({ id, data: Buffer.from(buf.subarray(off + 4, off + 4 + len)) })
    off += 4 + len
  }
  return pairs
}

function serializeAvPairs(pairs: AvPair[]): Buffer {
  const parts: Buffer[] = []
  for (const p of pairs) {
    const hdr = Buffer.alloc(4)
    hdr.writeUInt16LE(p.id, 0)
    hdr.writeUInt16LE(p.data.length, 2)
    parts.push(hdr, p.data)
  }
  // Terminate with MsvAvEOL
  const eol = Buffer.alloc(4)
  parts.push(eol)
  return Buffer.concat(parts)
}

/**
 * Get the server's NetBIOS domain name from TargetInfo.
 * Falls back to empty string if not found.
 */
export function getNetBiosDomain(targetInfo: Buffer): string {
  const pairs = parseAvPairs(targetInfo)
  const nbDomain = pairs.find((p) => p.id === MsvAvNbDomainName)
  return nbDomain ? nbDomain.data.toString('utf16le') : ''
}

/**
 * Check if MsvAvTimestamp is present (meaning MIC is required).
 * Returns the timestamp buffer or null.
 */
function getTimestamp(targetInfo: Buffer): Buffer | null {
  const pairs = parseAvPairs(targetInfo)
  const ts = pairs.find((p) => p.id === MsvAvTimestamp)
  return ts ? ts.data : null
}

/**
 * Process TargetInfo for Type 3:
 * - If MsvAvTimestamp present → add MsvAvFlags=0x02 (MIC_PROVIDED) before EOL
 * - Returns { modifiedTargetInfo, hasMic, timestamp }
 */
function processTargetInfo(targetInfo: Buffer): {
  modifiedTargetInfo: Buffer
  hasMic: boolean
  timestamp: Buffer | null
} {
  const pairs = parseAvPairs(targetInfo)
  const timestamp = getTimestamp(targetInfo)
  const hasMic = timestamp !== null

  if (hasMic) {
    // Remove any existing MsvAvFlags
    const filtered = pairs.filter((p) => p.id !== MsvAvFlags)
    // Add MsvAvFlags = 0x02 (MIC_PROVIDED)
    const flagData = Buffer.alloc(4)
    flagData.writeUInt32LE(0x02, 0)
    filtered.push({ id: MsvAvFlags, data: flagData })
    return { modifiedTargetInfo: serializeAvPairs(filtered), hasMic, timestamp }
  }

  return { modifiedTargetInfo: serializeAvPairs(pairs), hasMic, timestamp }
}

// ═══════════════════════════════════════════════════════════════
// Crypto primitives
// ═══════════════════════════════════════════════════════════════

function hmacMd5(key: Buffer, data: Buffer): Buffer {
  return createHmac('md5', key).update(data).digest()
}

function md4Hash(data: Buffer): Buffer {
  return Buffer.from(md4.arrayBuffer(data))
}

/** NTOWFv2 = HMAC_MD5(MD4(UTF16LE(password)), UTF16LE(UPPER(username) + domain)) */
function ntowfv2(password: string, username: string, domain: string): Buffer {
  const passwordHash = md4Hash(Buffer.from(password, 'utf16le'))
  const identity = Buffer.from((username.toUpperCase() + domain).normalize('NFC'), 'utf16le')
  return hmacMd5(passwordHash, identity)
}

// ═══════════════════════════════════════════════════════════════
// Type 3 (Authenticate)
// ═══════════════════════════════════════════════════════════════

export interface Type3Result {
  type3: Buffer
  sessionBaseKey: Buffer
}

/**
 * Create NTLM Type 3 (Authenticate) message with optional MIC.
 *
 * @param type1 - The raw Type 1 message we sent (for MIC)
 * @param type2Info - Parsed Type 2 from server
 * @param username - Plain username (no DOMAIN\ prefix)
 * @param password - Password
 * @param domain - Domain to use for NTOWFv2 (should be server's NetBIOS domain from Type 2 TargetInfo)
 * @param workstation - Workstation name (can be empty)
 */
export function createType3(
  type1: Buffer,
  type2Info: Type2Info,
  username: string,
  password: string,
  domain: string,
  workstation: string = '',
): Type3Result {
  const { serverChallenge, targetInfo, rawType2 } = type2Info
  const { modifiedTargetInfo, hasMic, timestamp: serverTimestamp } = processTargetInfo(targetInfo)

  const responseKeyNT = ntowfv2(password, username, domain)

  // Client challenge (8 random bytes)
  const clientChallenge = randomBytes(8)

  // Timestamp: use server's timestamp from TargetInfo, or generate one
  let timestamp: Buffer
  if (serverTimestamp) {
    timestamp = serverTimestamp
  } else {
    // FILETIME: 100ns intervals since Jan 1, 1601
    const epoch1601 = BigInt('116444736000000000')
    const now = epoch1601 + BigInt(Date.now()) * BigInt(10000)
    timestamp = Buffer.alloc(8)
    timestamp.writeBigUInt64LE(now)
  }

  // NTLMv2 client challenge structure (temp):
  //   1 byte  RespType = 1
  //   1 byte  HiRespType = 1
  //   2 bytes Reserved1 = 0
  //   4 bytes Reserved2 = 0
  //   8 bytes TimeStamp
  //   8 bytes ChallengeFromClient
  //   4 bytes Reserved3 = 0
  //   variable AvPairs (modifiedTargetInfo)
  //   4 bytes Reserved4 = 0  (already included as MsvAvEOL in serialized TargetInfo)
  const temp = Buffer.alloc(28 + modifiedTargetInfo.length)
  temp[0] = 1 // RespType
  temp[1] = 1 // HiRespType
  // Reserved1 (2), Reserved2 (4) = 0
  timestamp.copy(temp, 8)
  clientChallenge.copy(temp, 16)
  // Reserved3 (4) = 0 at offset 24
  modifiedTargetInfo.copy(temp, 28)

  // NtProofStr = HMAC_MD5(ResponseKeyNT, ServerChallenge || temp)
  const ntProofStr = hmacMd5(responseKeyNT, Buffer.concat([serverChallenge, temp]))

  // NtChallengeResponse = NtProofStr || temp
  const ntChallengeResponse = Buffer.concat([ntProofStr, temp])

  // SessionBaseKey = HMAC_MD5(ResponseKeyNT, NtProofStr)
  const sessionBaseKey = hmacMd5(responseKeyNT, ntProofStr)

  // Encode strings as UTF-16LE
  const domainBuf = Buffer.from(domain, 'utf16le')
  const userBuf = Buffer.from(username, 'utf16le')
  const wsBuf = Buffer.from(workstation, 'utf16le')

  // LM response: zero-length when MIC is present
  const lmResponse = Buffer.alloc(0)

  // EncryptedRandomSessionKey: zero-length (no KEY_EXCH)
  const encryptedSessionKey = Buffer.alloc(0)

  // Type 3 header size: 88 bytes when VERSION + MIC present, 64 bytes otherwise
  const headerSize = hasMic ? 88 : 72 // 64 base + 8 version (+ 16 MIC if hasMic)

  // Compute payload offsets
  let offset = headerSize
  const lmOff = offset
  offset += lmResponse.length
  const ntOff = offset
  offset += ntChallengeResponse.length
  const domOff = offset
  offset += domainBuf.length
  const userOff = offset
  offset += userBuf.length
  const wsOff = offset
  offset += wsBuf.length
  const eskOff = offset
  offset += encryptedSessionKey.length

  const totalLen = offset
  const type3 = Buffer.alloc(totalLen)

  // Signature
  NTLMSSP_SIGNATURE.copy(type3, 0)
  // MessageType = 3
  type3.writeUInt32LE(3, 8)

  // LmChallengeResponseFields (offset 12)
  type3.writeUInt16LE(lmResponse.length, 12) // Len
  type3.writeUInt16LE(lmResponse.length, 14) // MaxLen
  type3.writeUInt32LE(lmOff, 16) // Offset

  // NtChallengeResponseFields (offset 20)
  type3.writeUInt16LE(ntChallengeResponse.length, 20)
  type3.writeUInt16LE(ntChallengeResponse.length, 22)
  type3.writeUInt32LE(ntOff, 24)

  // DomainNameFields (offset 28)
  type3.writeUInt16LE(domainBuf.length, 28)
  type3.writeUInt16LE(domainBuf.length, 30)
  type3.writeUInt32LE(domOff, 32)

  // UserNameFields (offset 36)
  type3.writeUInt16LE(userBuf.length, 36)
  type3.writeUInt16LE(userBuf.length, 38)
  type3.writeUInt32LE(userOff, 40)

  // WorkstationFields (offset 44)
  type3.writeUInt16LE(wsBuf.length, 44)
  type3.writeUInt16LE(wsBuf.length, 46)
  type3.writeUInt32LE(wsOff, 48)

  // EncryptedRandomSessionKeyFields (offset 52)
  type3.writeUInt16LE(encryptedSessionKey.length, 52)
  type3.writeUInt16LE(encryptedSessionKey.length, 54)
  type3.writeUInt32LE(eskOff, 56)

  // NegotiateFlags (offset 60)
  type3.writeUInt32LE(NEGOTIATE_FLAGS, 60)

  // Version (offset 64)
  VERSION.copy(type3, 64)

  // MIC field at offset 72 — zeroed initially (filled after MIC computation)
  // Already zero from Buffer.alloc

  // Payloads
  lmResponse.copy(type3, lmOff)
  ntChallengeResponse.copy(type3, ntOff)
  domainBuf.copy(type3, domOff)
  userBuf.copy(type3, userOff)
  wsBuf.copy(type3, wsOff)
  encryptedSessionKey.copy(type3, eskOff)

  // Compute and insert MIC
  if (hasMic) {
    // MIC = HMAC_MD5(ExportedSessionKey, Type1 || Type2 || Type3_with_zeroed_MIC)
    // ExportedSessionKey = SessionBaseKey (no KEY_EXCH)
    const mic = hmacMd5(sessionBaseKey, Buffer.concat([type1, rawType2, type3]))
    mic.copy(type3, 72) // Write MIC at offset 72
  }

  return { type3, sessionBaseKey }
}

// ═══════════════════════════════════════════════════════════════
// LMv2 (for completeness — not used when MIC is present)
// ═══════════════════════════════════════════════════════════════

/** Expand 7-byte key to 8-byte DES key with parity bits */
function expandDesKey(key56: Buffer): Buffer {
  const key64 = Buffer.alloc(8)
  key64[0] = key56[0] >> 1
  key64[1] = ((key56[0] & 0x01) << 6) | (key56[1] >> 2)
  key64[2] = ((key56[1] & 0x03) << 5) | (key56[2] >> 3)
  key64[3] = ((key56[2] & 0x07) << 4) | (key56[3] >> 4)
  key64[4] = ((key56[3] & 0x0f) << 3) | (key56[4] >> 5)
  key64[5] = ((key56[4] & 0x1f) << 2) | (key56[5] >> 6)
  key64[6] = ((key56[5] & 0x3f) << 1) | (key56[6] >> 7)
  key64[7] = key56[6] & 0x7f
  // Set parity bits
  for (let i = 0; i < 8; i++) {
    key64[i] = (key64[i] << 1) & 0xfe
  }
  return key64
}

/** DES-ECB encrypt using des.js (OpenSSL 3.x disables DES-ECB) */
function desEncrypt(key7: Buffer, data: Buffer): Buffer {
  const key8 = expandDesKey(key7)
  const cipher = DES.create({ type: 'encrypt', key: Array.from(key8) as number[] })
  const result = cipher.update(Array.from(data) as number[])
  return Buffer.from(result)
}

export { desEncrypt, expandDesKey }
