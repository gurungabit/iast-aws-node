/**
 * Minimal NTLM authentication for SMB2.
 * Implements NTLMv2 (Type 1 Negotiate, Type 2 Challenge parse, Type 3 Authenticate).
 */

import { createHmac, randomBytes } from 'crypto'
import md4 from 'js-md4'

const NTLMSSP_SIGNATURE = Buffer.from('NTLMSSP\0')

// NTLM flags
const FLAGS =
  0x00000001 | // NEGOTIATE_UNICODE
  0x00000002 | // NEGOTIATE_OEM
  0x00000004 | // REQUEST_TARGET
  0x00000200 | // NEGOTIATE_NTLM
  0x00008000 | // NEGOTIATE_ALWAYS_SIGN
  0x00080000 | // NEGOTIATE_EXTENDED_SESSIONSECURITY
  0x00800000 | // NEGOTIATE_TARGET_INFO
  0x02000000 | // NEGOTIATE_VERSION
  0x20000000 | // NEGOTIATE_128
  0x40000000   // NEGOTIATE_KEY_EXCH

/** Create NTLM Type 1 (Negotiate) message */
export function createType1(): Buffer {
  const buf = Buffer.alloc(40) // 32 base + 8 version
  NTLMSSP_SIGNATURE.copy(buf, 0)
  buf.writeUInt32LE(1, 8) // Type 1
  buf.writeUInt32LE(FLAGS, 12)
  // Domain and workstation fields left empty (offset 16-31)
  // Version at offset 32
  buf.writeUInt8(10, 32)        // ProductMajorVersion (Windows 10)
  buf.writeUInt8(0, 33)         // ProductMinorVersion
  buf.writeUInt16LE(19041, 34)  // ProductBuild
  buf.writeUInt8(15, 39)        // NTLMRevisionCurrent = NTLMSSP_REVISION_W2K3
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
const MsvAvFlags = 6
const MsvAvTimestamp = 7

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

/**
 * Process TargetInfo for MIC support (MS-NLMP 3.1.5.1.2).
 * If MsvAvTimestamp is present, adds MsvAvFlags=0x02 (MIC_PROVIDED) before MsvAvEOL.
 * Returns the (possibly modified) TargetInfo and whether MIC should be computed.
 */
function processTargetInfo(targetInfo: Buffer): { modified: Buffer; hasTimestamp: boolean } {
  let hasTimestamp = false
  let hasFlags = false
  let offset = 0

  while (offset + 4 <= targetInfo.length) {
    const avId = targetInfo.readUInt16LE(offset)
    const avLen = targetInfo.readUInt16LE(offset + 2)
    if (avId === 0) break // MsvAvEOL
    if (avId === MsvAvTimestamp) hasTimestamp = true
    if (avId === MsvAvFlags) hasFlags = true
    offset += 4 + avLen
  }

  if (!hasTimestamp) return { modified: targetInfo, hasTimestamp: false }
  // Already has flags — don't double-add
  if (hasFlags) return { modified: targetInfo, hasTimestamp: true }

  // Insert MsvAvFlags (AvId=6, Value=0x00000002) before MsvAvEOL
  const beforeEol = targetInfo.subarray(0, offset)
  const flagsPair = Buffer.alloc(8) // AvId(2) + AvLen(2) + Value(4)
  flagsPair.writeUInt16LE(MsvAvFlags, 0)
  flagsPair.writeUInt16LE(4, 2)
  flagsPair.writeUInt32LE(0x00000002, 4) // MIC_PROVIDED
  const eol = Buffer.alloc(4) // MsvAvEOL: AvId=0, AvLen=0

  return { modified: Buffer.concat([beforeEol, flagsPair, eol]), hasTimestamp: true }
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

/** Create NTLM Type 3 (Authenticate) message */
export function createType3(
  type1: Buffer,
  type2: Buffer,
  username: string,
  password: string,
  domain: string,
): Buffer {
  const { serverChallenge, targetInfo, serverDomain } = parseType2(type2)
  const clientChallenge = randomBytes(8)

  // Use server-provided domain for NTLMv2 hash (most reliable),
  // fall back to caller-provided domain
  const hashDomain = serverDomain || domain
  console.log(`[NTLM] server domain="${serverDomain}", config domain="${domain}", using="${hashDomain}" for NTLMv2`)
  console.log(`[NTLM] serverChallenge=${serverChallenge.toString('hex')}, targetInfo(${targetInfo.length}b)=${targetInfo.subarray(0, 32).toString('hex')}...`)

  // Detect MsvAvTimestamp but don't modify TargetInfo yet (MIC disabled for debugging)
  const { hasTimestamp } = processTargetInfo(targetInfo)
  const processedTargetInfo = targetInfo
  console.log(`[NTLM] hasTimestamp=${hasTimestamp}, targetInfo(${processedTargetInfo.length}b) [MIC off, KEY_EXCH on]`)

  const responseKeyNT = ntowfv2(password, username, hashDomain)
  const { ntProofStr, ntChallengeResponse } = computeNtlmV2Response(
    responseKeyNT, serverChallenge, clientChallenge, processedTargetInfo,
  )

  // Session base key
  const sessionBaseKey = createHmac('md5', responseKeyNT).update(ntProofStr).digest()

  // KEY_EXCH: generate random ExportedSessionKey, encrypt with RC4(SessionBaseKey)
  const exportedSessionKey = randomBytes(16)
  const encryptedSessionKey = rc4(sessionBaseKey, exportedSessionKey)
  console.log(`[NTLM] KEY_EXCH: sessionBaseKey=${sessionBaseKey.subarray(0, 4).toString('hex')}..., encSK(${encryptedSessionKey.length}b)`)

  const domainBuf = Buffer.from(hashDomain, 'utf16le')
  const userBuf = Buffer.from(username, 'utf16le')
  const workstationBuf = Buffer.from('', 'utf16le')

  // LM response (MIC disabled: compute normally)
  const lmResponse = Buffer.concat([
    createHmac('md5', responseKeyNT)
      .update(Buffer.concat([serverChallenge, clientChallenge]))
      .digest(),
    clientChallenge,
  ])

  // Layout: fixed header (88 bytes = 64 base + 8 version + 16 MIC) + payloads
  let offset = 88
  const domainOffset = offset; offset += domainBuf.length
  const userOffset = offset; offset += userBuf.length
  const wsOffset = offset; offset += workstationBuf.length
  const lmOffset = offset; offset += lmResponse.length
  const ntOffset = offset; offset += ntChallengeResponse.length
  const skOffset = offset; offset += encryptedSessionKey.length

  const buf = Buffer.alloc(offset)
  NTLMSSP_SIGNATURE.copy(buf, 0)
  buf.writeUInt32LE(3, 8) // Type 3

  // LM response
  buf.writeUInt16LE(lmResponse.length, 12)
  buf.writeUInt16LE(lmResponse.length, 14)
  buf.writeUInt32LE(lmOffset, 16)

  // NT response
  buf.writeUInt16LE(ntChallengeResponse.length, 20)
  buf.writeUInt16LE(ntChallengeResponse.length, 22)
  buf.writeUInt32LE(ntOffset, 24)

  // Domain
  buf.writeUInt16LE(domainBuf.length, 28)
  buf.writeUInt16LE(domainBuf.length, 30)
  buf.writeUInt32LE(domainOffset, 32)

  // Username
  buf.writeUInt16LE(userBuf.length, 36)
  buf.writeUInt16LE(userBuf.length, 38)
  buf.writeUInt32LE(userOffset, 40)

  // Workstation
  buf.writeUInt16LE(workstationBuf.length, 44)
  buf.writeUInt16LE(workstationBuf.length, 46)
  buf.writeUInt32LE(wsOffset, 48)

  // Encrypted session key (KEY_EXCH: RC4(SessionBaseKey, ExportedSessionKey))
  buf.writeUInt16LE(encryptedSessionKey.length, 52)
  buf.writeUInt16LE(encryptedSessionKey.length, 54)
  buf.writeUInt32LE(skOffset, 56)

  // Flags
  buf.writeUInt32LE(FLAGS, 60)

  // Version at offset 64
  buf.writeUInt8(10, 64)        // ProductMajorVersion (Windows 10)
  buf.writeUInt8(0, 65)         // ProductMinorVersion
  buf.writeUInt16LE(19041, 66)  // ProductBuild
  buf.writeUInt8(15, 71)        // NTLMRevisionCurrent = NTLMSSP_REVISION_W2K3

  // MIC at offset 72 (16 bytes) — zeroed initially, computed below

  // Copy payloads
  domainBuf.copy(buf, domainOffset)
  userBuf.copy(buf, userOffset)
  workstationBuf.copy(buf, wsOffset)
  lmResponse.copy(buf, lmOffset)
  ntChallengeResponse.copy(buf, ntOffset)
  encryptedSessionKey.copy(buf, skOffset)

  // MIC disabled for debugging — isolate KEY_EXCH behavior
  console.log(`[NTLM] Type3 size=${buf.length}, flags=0x${FLAGS.toString(16)}, KEY_EXCH=on, MIC=off`)
  return buf
}

/** Wrap an NTLM token in SPNEGO (GSS-API) for SMB2 Session Setup */
export function wrapSpnego(ntlmToken: Buffer): Buffer {
  // SPNEGO mechToken wrapping for NTLM
  const mechType = Buffer.from([
    0x06, 0x0a, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x82, 0x37, 0x02, 0x02, 0x0a,
  ]) // OID 1.3.6.1.4.1.311.2.2.10 (NTLMSSP)

  return buildSpnegoInit(mechType, ntlmToken)
}

/** Wrap NTLM Type 3 in SPNEGO responseToken */
export function wrapSpnegoAuth(ntlmToken: Buffer): Buffer {
  // mechToken [2] OCTET STRING
  const mechTokenWrapped = asn1Wrap(0xa2, asn1Wrap(0x04, ntlmToken))
  // NegTokenResp [1]
  const negTokenResp = asn1Wrap(0xa1, asn1Wrap(0x30, mechTokenWrapped))
  return negTokenResp
}

function buildSpnegoInit(mechType: Buffer, mechToken: Buffer): Buffer {
  // mechTypes [0] MechTypeList (SEQUENCE OF OID)
  const mechTypes = asn1Wrap(0xa0, asn1Wrap(0x30, mechType))
  // mechToken [2] OCTET STRING
  const mechTokenField = asn1Wrap(0xa2, asn1Wrap(0x04, mechToken))
  // NegTokenInit SEQUENCE
  const negTokenInit = asn1Wrap(0x30, Buffer.concat([mechTypes, mechTokenField]))
  // [0] explicit tag
  const contextTag = asn1Wrap(0xa0, negTokenInit)
  // Application [0] with SPNEGO OID
  const spnegoOid = Buffer.from([0x06, 0x06, 0x2b, 0x06, 0x01, 0x05, 0x05, 0x02]) // 1.3.6.1.5.5.2
  return asn1Wrap(0x60, Buffer.concat([spnegoOid, contextTag]))
}

/** RC4 stream cipher (needed for KEY_EXCH; OpenSSL 3.x disables RC4) */
function rc4(key: Buffer, data: Buffer): Buffer {
  // Key-Scheduling Algorithm (KSA)
  const S = new Uint8Array(256)
  for (let i = 0; i < 256; i++) S[i] = i
  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff
    const tmp = S[i]; S[i] = S[j]; S[j] = tmp
  }
  // Pseudo-Random Generation Algorithm (PRGA)
  const out = Buffer.alloc(data.length)
  let a = 0, b = 0
  for (let k = 0; k < data.length; k++) {
    a = (a + 1) & 0xff
    b = (b + S[a]) & 0xff
    const tmp = S[a]; S[a] = S[b]; S[b] = tmp
    out[k] = data[k] ^ S[(S[a] + S[b]) & 0xff]
  }
  return out
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
    // 3-byte length
    header = Buffer.alloc(5)
    header[0] = tag
    header[1] = 0x83
    header[2] = (len >> 16) & 0xff
    header.writeUInt16BE(len & 0xffff, 3)
  }
  return Buffer.concat([header, data])
}
