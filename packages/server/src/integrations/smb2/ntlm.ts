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
  0x00000008 | // REQUEST_TARGET
  0x00000200 | // NEGOTIATE_NTLM
  0x00008000 | // NEGOTIATE_ALWAYS_SIGN
  0x00080000 | // NEGOTIATE_NTLM2_KEY
  0x02000000 | // NEGOTIATE_TARGET_INFO
  0x20000000   // NEGOTIATE_128

/** Create NTLM Type 1 (Negotiate) message */
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

  return { serverChallenge, targetInfo }
}

function ntowfv2(password: string, username: string, domain: string): Buffer {
  // MD4(UTF-16LE(password))
  const passUtf16 = Buffer.from(password, 'utf16le')
  const ntHash = Buffer.from(md4.arrayBuffer(passUtf16))

  // HMAC-MD5(ntHash, UTF-16LE(UPPER(username) + domain))
  const identity = Buffer.from((username.toUpperCase() + domain).normalize(), 'utf16le')
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
  type2: Buffer,
  username: string,
  password: string,
  domain: string,
): Buffer {
  const { serverChallenge, targetInfo } = parseType2(type2)
  const clientChallenge = randomBytes(8)

  const responseKeyNT = ntowfv2(password, username, domain)
  const { ntProofStr, ntChallengeResponse } = computeNtlmV2Response(
    responseKeyNT, serverChallenge, clientChallenge, targetInfo,
  )

  // Session key
  const sessionBaseKey = createHmac('md5', responseKeyNT).update(ntProofStr).digest()

  const domainBuf = Buffer.from(domain, 'utf16le')
  const userBuf = Buffer.from(username, 'utf16le')
  const workstationBuf = Buffer.from('', 'utf16le')

  // Layout: fixed header (88 bytes) + domain + user + workstation + lmResponse(24) + ntResponse + sessionKey(16)
  const lmResponse = Buffer.concat([
    createHmac('md5', responseKeyNT)
      .update(Buffer.concat([serverChallenge, clientChallenge]))
      .digest(),
    clientChallenge,
  ])

  let offset = 88
  const domainOffset = offset; offset += domainBuf.length
  const userOffset = offset; offset += userBuf.length
  const wsOffset = offset; offset += workstationBuf.length
  const lmOffset = offset; offset += lmResponse.length
  const ntOffset = offset; offset += ntChallengeResponse.length
  const skOffset = offset; offset += sessionBaseKey.length

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

  // Session key
  buf.writeUInt16LE(sessionBaseKey.length, 52)
  buf.writeUInt16LE(sessionBaseKey.length, 54)
  buf.writeUInt32LE(skOffset, 56)

  // Flags
  buf.writeUInt32LE(FLAGS, 60)

  // Copy payloads
  domainBuf.copy(buf, domainOffset)
  userBuf.copy(buf, userOffset)
  workstationBuf.copy(buf, wsOffset)
  lmResponse.copy(buf, lmOffset)
  ntChallengeResponse.copy(buf, ntOffset)
  sessionBaseKey.copy(buf, skOffset)

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
