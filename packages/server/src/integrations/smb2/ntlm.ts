/**
 * Minimal NTLM authentication for SMB2.
 * Implements NTLMv2 with raw NTLM tokens (no SPNEGO wrapping).
 * Modeled after github.com/awo00/smb2 reference implementation.
 */

import { createHmac, randomBytes } from 'crypto'
import md4 from 'js-md4'

const NTLMSSP_SIGNATURE = Buffer.from('NTLMSSP\0')

// Minimal NTLM flags — match reference (no KEY_EXCH, no VERSION, no 128-bit)
const FLAGS =
  0x00000001 | // NEGOTIATE_UNICODE
  0x00000200 | // NEGOTIATE_NTLM
  0x00008000 | // NEGOTIATE_ALWAYS_SIGN
  0x00080000   // NEGOTIATE_EXTENDED_SESSIONSECURITY (needed for NTLMv2 TargetInfo)

/** Create NTLM Type 1 (Negotiate) message — 32 bytes, no VERSION */
export function createType1(): Buffer {
  const buf = Buffer.alloc(32)
  NTLMSSP_SIGNATURE.copy(buf, 0)
  buf.writeUInt32LE(1, 8) // Type 1
  buf.writeUInt32LE(FLAGS, 12)
  // Domain and workstation fields left empty (offset 16-31)
  return buf
}

interface Type2Fields {
  serverChallenge: Buffer
  targetInfo: Buffer
  /** NetBIOS domain name extracted from AvPairs (MsvAvNbDomainName) */
  serverDomain: string
}

// AvPair IDs from MS-NLMP
const MsvAvNbDomainName = 2
const MsvAvDnsDomainName = 4

/** Parse AvPairs from Type 2 target info to extract domain names */
function parseAvPairs(targetInfo: Buffer): { nbDomain: string; dnsDomain: string } {
  let nbDomain = ''
  let dnsDomain = ''
  let offset = 0

  while (offset + 4 <= targetInfo.length) {
    const avId = targetInfo.readUInt16LE(offset)
    const avLen = targetInfo.readUInt16LE(offset + 2)
    if (avId === 0) break // MsvAvEOL

    const value = targetInfo.subarray(offset + 4, offset + 4 + avLen)
    if (avId === MsvAvNbDomainName) {
      nbDomain = value.toString('utf16le').replace(/\0/g, '')
    } else if (avId === MsvAvDnsDomainName) {
      dnsDomain = value.toString('utf16le').replace(/\0/g, '')
    }
    offset += 4 + avLen
  }

  return { nbDomain, dnsDomain }
}

/** Parse NTLM Type 2 (Challenge) message */
export function parseType2(buf: Buffer): Type2Fields {
  const sig = buf.subarray(0, 8)
  if (!sig.equals(NTLMSSP_SIGNATURE)) {
    throw new Error('Invalid NTLMSSP signature in Type 2 message')
  }
  const type = buf.readUInt32LE(8)
  if (type !== 2) throw new Error(`Expected Type 2, got Type ${type}`)

  const serverChallenge = Buffer.from(buf.subarray(24, 32))

  // Target info: length at offset 40, offset at 44
  const targetInfoLen = buf.readUInt16LE(40)
  const targetInfoOffset = buf.readUInt32LE(44)
  const targetInfo = Buffer.from(buf.subarray(targetInfoOffset, targetInfoOffset + targetInfoLen))

  // Extract domain from AvPairs
  const avPairs = parseAvPairs(targetInfo)
  const serverDomain = avPairs.nbDomain || avPairs.dnsDomain

  return { serverChallenge, targetInfo, serverDomain }
}

function ntowfv2(password: string, username: string, domain: string): Buffer {
  // MD4(UTF-16LE(password))
  const passUtf16 = Buffer.from(password, 'utf16le')
  const ntHash = Buffer.from(md4.arrayBuffer(passUtf16))

  // HMAC-MD5(ntHash, UTF-16LE(UPPER(username) + domain))
  const identityStr = username.toUpperCase() + domain
  const identity = Buffer.from(identityStr, 'utf16le')

  console.log(`[NTLM] identity="${identityStr}", pwdLen=${password.length}, ntHash=${ntHash.subarray(0, 4).toString('hex')}...`)

  return createHmac('md5', ntHash).update(identity).digest()
}

function computeNtlmV2Response(
  responseKeyNT: Buffer,
  serverChallenge: Buffer,
  clientChallenge: Buffer,
  targetInfo: Buffer,
): { ntProofStr: Buffer; ntChallengeResponse: Buffer } {
  // Timestamp: Windows FILETIME (100ns intervals since 1601-01-01)
  const now = BigInt(Date.now()) * 10000n + 116444736000000000n
  const timestamp = Buffer.alloc(8)
  timestamp.writeBigUInt64LE(now)

  // Build temp (client blob)
  const blob = Buffer.concat([
    Buffer.from([0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // Version + reserved
    timestamp,
    clientChallenge,
    Buffer.alloc(4), // Reserved
    targetInfo,
    Buffer.alloc(4), // Reserved
  ])

  const ntProofStr = createHmac('md5', responseKeyNT)
    .update(Buffer.concat([serverChallenge, blob]))
    .digest()

  const ntChallengeResponse = Buffer.concat([ntProofStr, blob])
  return { ntProofStr, ntChallengeResponse }
}

/** Create NTLM Type 3 (Authenticate) message — 64-byte header, NTLMv2 */
export function createType3(
  _type1: Buffer,
  type2: Buffer,
  username: string,
  password: string,
  domain: string,
): Buffer {
  const { serverChallenge, targetInfo, serverDomain } = parseType2(type2)
  const clientChallenge = randomBytes(8)

  // Use server-provided NetBIOS domain for NTLMv2 hash
  const hashDomain = serverDomain || domain
  console.log(`[NTLM] domain="${hashDomain}", user="${username}", challenge=${serverChallenge.toString('hex')}`)

  const responseKeyNT = ntowfv2(password, username, hashDomain)
  const { ntChallengeResponse } = computeNtlmV2Response(
    responseKeyNT, serverChallenge, clientChallenge, targetInfo,
  )

  // LM response for NTLMv2
  const lmResponse = Buffer.concat([
    createHmac('md5', responseKeyNT)
      .update(Buffer.concat([serverChallenge, clientChallenge]))
      .digest(),
    clientChallenge,
  ])

  const domainBuf = Buffer.from(hashDomain, 'utf16le')
  const userBuf = Buffer.from(username, 'utf16le')
  const workstationBuf = Buffer.alloc(0)

  // 64-byte fixed header (no VERSION, no MIC) + payloads
  const HEADER_SIZE = 64
  let offset = HEADER_SIZE
  const domainOffset = offset; offset += domainBuf.length
  const userOffset = offset; offset += userBuf.length
  const wsOffset = offset; offset += workstationBuf.length
  const lmOffset = offset; offset += lmResponse.length
  const ntOffset = offset; offset += ntChallengeResponse.length

  const buf = Buffer.alloc(offset)
  NTLMSSP_SIGNATURE.copy(buf, 0)
  buf.writeUInt32LE(3, 8) // Type 3

  // LM response fields
  buf.writeUInt16LE(lmResponse.length, 12)
  buf.writeUInt16LE(lmResponse.length, 14)
  buf.writeUInt32LE(lmOffset, 16)

  // NT response fields
  buf.writeUInt16LE(ntChallengeResponse.length, 20)
  buf.writeUInt16LE(ntChallengeResponse.length, 22)
  buf.writeUInt32LE(ntOffset, 24)

  // Domain fields
  buf.writeUInt16LE(domainBuf.length, 28)
  buf.writeUInt16LE(domainBuf.length, 30)
  buf.writeUInt32LE(domainOffset, 32)

  // Username fields
  buf.writeUInt16LE(userBuf.length, 36)
  buf.writeUInt16LE(userBuf.length, 38)
  buf.writeUInt32LE(userOffset, 40)

  // Workstation fields
  buf.writeUInt16LE(workstationBuf.length, 44)
  buf.writeUInt16LE(workstationBuf.length, 46)
  buf.writeUInt32LE(wsOffset, 48)

  // Encrypted session key fields (no KEY_EXCH — all zeros)
  // offset 52-59: Len=0, MaxLen=0, Offset=0

  // Negotiate flags
  buf.writeUInt32LE(FLAGS, 60)

  // Copy payloads
  domainBuf.copy(buf, domainOffset)
  userBuf.copy(buf, userOffset)
  workstationBuf.copy(buf, wsOffset)
  lmResponse.copy(buf, lmOffset)
  ntChallengeResponse.copy(buf, ntOffset)

  console.log(`[NTLM] Type3: ${buf.length}b, flags=0x${FLAGS.toString(16)}, lm=${lmResponse.length}b, nt=${ntChallengeResponse.length}b`)
  return buf
}

/** Extract NTLM token from a buffer that may be raw NTLM or SPNEGO-wrapped */
export function extractNtlmToken(buf: Buffer): Buffer {
  const sig = Buffer.from('NTLMSSP\0')
  // Raw NTLM — starts with NTLMSSP signature
  if (buf.length >= 8 && buf.subarray(0, 8).equals(sig)) {
    return buf
  }
  // SPNEGO-wrapped — search for NTLMSSP signature inside
  const idx = buf.indexOf(sig)
  if (idx === -1) {
    throw new Error('NTLMSSP token not found in response')
  }
  return Buffer.from(buf.subarray(idx))
}
