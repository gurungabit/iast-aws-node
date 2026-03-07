/**
 * Minimal SMB2 client: Negotiate → SessionSetup (SPNEGO/NTLMv2) → TreeConnect → Read → Close.
 * Supports DFS namespace referrals (FSCTL_DFS_GET_REFERRALS via IPC$).
 *
 * Implements just enough of the SMB2 protocol to read files from a share.
 * Packet framing follows [MS-SMB2] with NetBIOS session header (4-byte length prefix).
 */

import { Socket } from 'net'
import { createHmac, randomBytes } from 'crypto'
import {
  createType1,
  createType3,
  extractNtlmToken,
  getNetBiosDomain,
  parseType2,
  wrapSpnegoInit,
  wrapSpnegoAuth,
} from './ntlm.js'

// ── SMB2 Constants ──

const SMB2_MAGIC = Buffer.from([0xfe, 0x53, 0x4d, 0x42]) // 0xFE 'S' 'M' 'B'
const SMB2_HEADER_SIZE = 64
const SMB2_NEGOTIATE = 0x0000
const SMB2_SESSION_SETUP = 0x0001
const SMB2_TREE_CONNECT = 0x0003
const SMB2_CREATE = 0x0005
const SMB2_CLOSE = 0x0006
const SMB2_READ = 0x0008
const SMB2_IOCTL = 0x000b

// Flags
const SMB2_FLAGS_SIGNED = 0x00000008

// Status codes
const STATUS_SUCCESS = 0x00000000
const STATUS_MORE_PROCESSING_REQUIRED = 0xc0000016
const STATUS_BAD_NETWORK_NAME = 0xc00000cc

// Dialects
const SMB2_DIALECT_0202 = 0x0202
const SMB2_DIALECT_0210 = 0x0210

// Create disposition
const FILE_OPEN = 0x00000001

// Access mask
const FILE_READ_DATA = 0x00000001
const FILE_READ_ATTRIBUTES = 0x00000080

// Share access
const FILE_SHARE_READ = 0x00000001

// IOCTL
const FSCTL_DFS_GET_REFERRALS = 0x00060194
const SMB2_0_IOCTL_IS_FSCTL = 0x00000001

// ═══════════════════════════════════════════════════════════════
// SMB2 Packet Builder
// ═══════════════════════════════════════════════════════════════

let messageIdCounter = 0n

function buildSmb2Header(command: number, opts: {
  sessionId?: bigint
  treeId?: number
} = {}): Buffer {
  const hdr = Buffer.alloc(SMB2_HEADER_SIZE)
  SMB2_MAGIC.copy(hdr, 0)
  hdr.writeUInt16LE(SMB2_HEADER_SIZE, 4) // StructureSize
  hdr.writeUInt16LE(1, 6) // CreditCharge
  // Status = 0 (offset 8)
  hdr.writeUInt16LE(command, 12) // Command
  hdr.writeUInt16LE(1, 14) // CreditRequest
  // Flags = 0 (offset 16)
  // NextCommand = 0 (offset 20)
  hdr.writeBigUInt64LE(messageIdCounter++, 24) // MessageId
  // Reserved (offset 32) = 0
  hdr.writeUInt32LE(opts.treeId ?? 0, 36) // TreeId
  hdr.writeBigUInt64LE(opts.sessionId ?? 0n, 40) // SessionId
  // Signature zeroed (offset 48, 16 bytes)
  return hdr
}

function framePacket(hdr: Buffer, body: Buffer): Buffer {
  const pkt = Buffer.concat([hdr, body])
  const nb = Buffer.alloc(4)
  nb.writeUInt32BE(pkt.length, 0)
  return Buffer.concat([nb, pkt])
}

/** Sign an SMB2 packet (after NetBIOS header). Modifies the buffer in-place. */
function signPacket(framed: Buffer, signingKey: Buffer): void {
  const pkt = framed.subarray(4)
  const flags = pkt.readUInt32LE(16)
  pkt.writeUInt32LE(flags | SMB2_FLAGS_SIGNED, 16)
  pkt.fill(0, 48, 64)
  const sig = createHmac('sha256', signingKey).update(pkt).digest()
  sig.copy(pkt, 48, 0, 16)
}

/** Build, frame, sign, send, and parse a signed request. */
async function signedSend(
  transport: Smb2Transport,
  command: number,
  body: Buffer,
  signingKey: Buffer,
  opts: { sessionId?: bigint; treeId?: number } = {},
): Promise<SmB2Response> {
  const hdr = buildSmb2Header(command, opts)
  const framed = framePacket(hdr, body)
  signPacket(framed, signingKey)
  return parseResponse(await transport.send(framed))
}

/** Build, frame, send (unsigned). */
async function unsignedSend(
  transport: Smb2Transport,
  command: number,
  body: Buffer,
  opts: { sessionId?: bigint; treeId?: number } = {},
): Promise<SmB2Response> {
  const hdr = buildSmb2Header(command, opts)
  return parseResponse(await transport.send(framePacket(hdr, body)))
}

// ═══════════════════════════════════════════════════════════════
// SMB2 Packet Parsers
// ═══════════════════════════════════════════════════════════════

interface SmB2Response {
  status: number
  command: number
  sessionId: bigint
  treeId: number
  body: Buffer
}

function parseResponse(pkt: Buffer): SmB2Response {
  if (!pkt.subarray(0, 4).equals(SMB2_MAGIC)) {
    throw new Error('Invalid SMB2 response: bad magic')
  }
  return {
    status: pkt.readUInt32LE(8),
    command: pkt.readUInt16LE(12),
    sessionId: pkt.readBigUInt64LE(40),
    treeId: pkt.readUInt32LE(36),
    body: pkt.subarray(SMB2_HEADER_SIZE),
  }
}

// ═══════════════════════════════════════════════════════════════
// TCP Transport
// ═══════════════════════════════════════════════════════════════

class Smb2Transport {
  private socket: Socket
  private buffer = Buffer.alloc(0)
  private pendingResolve: ((pkt: Buffer) => void) | null = null
  private pendingReject: ((err: Error) => void) | null = null
  private closed = false

  constructor(private host: string, private port: number, private timeout: number) {
    this.socket = new Socket()
    this.socket.on('data', (chunk: Buffer) => this.onData(chunk))
    this.socket.on('error', (err) => {
      if (this.pendingReject) {
        this.pendingReject(err)
        this.pendingResolve = null
        this.pendingReject = null
      }
    })
    this.socket.on('close', () => {
      this.closed = true
      if (this.pendingReject) {
        this.pendingReject(new Error('Connection closed'))
        this.pendingResolve = null
        this.pendingReject = null
      }
    })
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.destroy()
        reject(new Error(`Connection timeout to ${this.host}:${this.port}`))
      }, this.timeout)
      this.socket.connect(this.port, this.host, () => {
        clearTimeout(timer)
        resolve()
      })
      this.socket.once('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
  }

  private onData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    this.tryDeliver()
  }

  private tryDeliver() {
    if (!this.pendingResolve) return
    if (this.buffer.length < 4) return

    const pktLen = this.buffer.readUInt32BE(0)
    if (this.buffer.length < 4 + pktLen) return

    const pkt = Buffer.from(this.buffer.subarray(4, 4 + pktLen))
    this.buffer = Buffer.from(this.buffer.subarray(4 + pktLen))

    const resolve = this.pendingResolve
    this.pendingResolve = null
    this.pendingReject = null
    resolve(pkt)
  }

  async send(data: Buffer): Promise<Buffer> {
    if (this.closed) throw new Error('Transport closed')
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingResolve = null
        this.pendingReject = null
        reject(new Error(`Request timeout (${this.timeout}ms)`))
      }, this.timeout)

      this.pendingResolve = (pkt) => { clearTimeout(timer); resolve(pkt) }
      this.pendingReject = (err) => { clearTimeout(timer); reject(err) }
      this.socket.write(data)

      this.tryDeliver()
    })
  }

  close() {
    this.closed = true
    try { this.socket.destroy() } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════
// Connection + Authentication
// ═══════════════════════════════════════════════════════════════

interface AuthenticatedSession {
  transport: Smb2Transport
  sessionId: bigint
  signingKey: Buffer
}

async function connectAndAuth(
  host: string,
  port: number,
  timeout: number,
  domain: string,
  username: string,
  password: string,
): Promise<AuthenticatedSession> {
  messageIdCounter = 0n
  const transport = new Smb2Transport(host, port, timeout)
  await transport.connect()

  // Negotiate
  const negResp = await unsignedSend(transport, SMB2_NEGOTIATE, buildNegotiateBody())
  assertStatus(negResp, 'Negotiate', [STATUS_SUCCESS])

  // Session Setup 1 (NTLM Type 1)
  const type1Raw = createType1()
  const ss1Resp = await unsignedSend(
    transport, SMB2_SESSION_SETUP, buildSessionSetupBody(wrapSpnegoInit(type1Raw)),
  )
  assertStatus(ss1Resp, 'SessionSetup1', [STATUS_MORE_PROCESSING_REQUIRED])

  const sessionId = ss1Resp.sessionId
  const type2Raw = extractNtlmToken(extractSecurityBuffer(ss1Resp.body))
  const type2Info = parseType2(type2Raw)
  const serverDomain = getNetBiosDomain(type2Info.targetInfo) || domain
  console.log(`[SMB2] Server NetBIOS domain: "${serverDomain}", using for NTOWFv2`)

  // Session Setup 2 (NTLM Type 3 with MIC)
  const { type3, sessionBaseKey } = createType3(
    type1Raw, type2Info, username, password, serverDomain,
  )
  const ss2Resp = await unsignedSend(
    transport, SMB2_SESSION_SETUP, buildSessionSetupBody(wrapSpnegoAuth(type3)),
    { sessionId },
  )
  assertStatus(ss2Resp, 'SessionSetup2', [STATUS_SUCCESS])
  console.log(`[SMB2] Authentication successful on ${host}, sessionId=${sessionId}`)

  return { transport, sessionId, signingKey: sessionBaseKey }
}

// ═══════════════════════════════════════════════════════════════
// DFS Referral
// ═══════════════════════════════════════════════════════════════

interface DfsTarget {
  server: string
  share: string
  pathConsumed: number // number of UTF-16 chars consumed from request path
}

/** Issue a FSCTL_DFS_GET_REFERRALS on an existing IPC$ tree. Returns null on failure. */
async function tryDfsReferral(
  transport: Smb2Transport,
  sessionId: bigint,
  signingKey: Buffer,
  ipcTreeId: number,
  dfsPath: string,
): Promise<DfsTarget | null> {
  const ioctlBody = buildIoctlDfsBody(dfsPath)
  const ioctlResp = await signedSend(
    transport, SMB2_IOCTL, ioctlBody,
    signingKey, { sessionId, treeId: ipcTreeId },
  )

  if (ioctlResp.status !== STATUS_SUCCESS) {
    const hex = '0x' + (ioctlResp.status >>> 0).toString(16).padStart(8, '0')
    console.log(`[SMB2] DFS referral for "${dfsPath}" → ${hex}`)
    return null
  }

  try {
    return parseDfsReferralResponse(ioctlResp.body)
  } catch (err: any) {
    console.log(`[SMB2] DFS referral parse error for "${dfsPath}": ${err.message}`)
    // Dump the raw IOCTL response for debugging
    const hex = ioctlResp.body.subarray(0, Math.min(200, ioctlResp.body.length)).toString('hex')
    console.log(`[SMB2] IOCTL response body (first 200B): ${hex}`)
    return null
  }
}

/**
 * Resolve DFS path using multi-level referral.
 * Tries progressively shorter paths to find the DFS link target.
 */
async function resolveDfs(
  transport: Smb2Transport,
  sessionId: bigint,
  signingKey: Buffer,
  host: string,
  share: string,
  filePath: string,
  port: number,
  timeout: number,
  domain: string,
  username: string,
  password: string,
): Promise<{
  transport: Smb2Transport
  sessionId: bigint
  signingKey: Buffer
  treeId: number
  filePath: string
}> {
  // Connect to IPC$ once
  const ipcPath = `\\\\${host}\\IPC$`
  const ipcResp = await signedSend(
    transport, SMB2_TREE_CONNECT, buildTreeConnectBody(ipcPath),
    signingKey, { sessionId },
  )
  assertStatus(ipcResp, 'TreeConnect(IPC$)', [STATUS_SUCCESS])
  const ipcTreeId = ipcResp.treeId

  const filePathBs = filePath.replace(/\//g, '\\')

  // Build list of paths to try — progressively shorter, both \ and \\ prefixes
  // Full: \domain\share\path\to\file.txt
  // Then: \domain\share\path\to
  // Then: \domain\share\path
  // Then: \domain\share  (root referral)
  const pathParts = filePathBs.split('\\')
  const pathsToTry: string[] = []
  for (let i = pathParts.length; i >= 0; i--) {
    const subPath = i > 0 ? `\\${pathParts.slice(0, i).join('\\')}` : ''
    // Domain DFS format (single leading backslash)
    pathsToTry.push(`\\${host}\\${share}${subPath}`)
  }

  let target: DfsTarget | null = null
  let matchedPath = ''

  for (const dfsPath of pathsToTry) {
    target = await tryDfsReferral(transport, sessionId, signingKey, ipcTreeId, dfsPath)
    if (target) {
      matchedPath = dfsPath
      break
    }
  }

  if (!target) {
    throw new Error(`DFS referral resolution failed for \\\\${host}\\${share}\\${filePathBs} (tried ${pathsToTry.length} paths)`)
  }

  console.log(`[SMB2] DFS resolved "${matchedPath}" → \\\\${target.server}\\${target.share}`)

  // Compute remaining file path: original path minus consumed prefix
  const consumedChars = target.pathConsumed
  const fullRequestPath = matchedPath
  const consumedPrefix = fullRequestPath.substring(0, consumedChars)
  // The file path portion that wasn't consumed by DFS
  const remainingFromRequest = fullRequestPath.substring(consumedChars).replace(/^\\+/, '')
  // Add back any path parts that weren't in the request (if we used a shorter path)
  const requestedSubPath = fullRequestPath.substring(`\\${host}\\${share}`.length).replace(/^\\+/, '')
  const fullSubPath = filePathBs
  const unqueried = fullSubPath.substring(requestedSubPath.length).replace(/^\\+/, '')
  const actualFilePath = remainingFromRequest
    ? (unqueried ? `${remainingFromRequest}\\${unqueried}` : remainingFromRequest)
    : (unqueried || filePathBs)

  console.log(`[SMB2] DFS file path: "${actualFilePath}" (consumed=${consumedChars} chars from "${matchedPath}")`)

  // If target is a different server, close current and connect to target
  if (target.server.toLowerCase() !== host.toLowerCase()) {
    transport.close()
    const tgt = await connectAndAuth(target.server, port, timeout, domain, username, password)
    transport = tgt.transport
    sessionId = tgt.sessionId
    signingKey = tgt.signingKey
  }

  // TreeConnect to target share
  const targetSharePath = `\\\\${target.server}\\${target.share}`
  const treeResp = await signedSend(
    transport, SMB2_TREE_CONNECT, buildTreeConnectBody(targetSharePath),
    signingKey, { sessionId },
  )
  assertStatus(treeResp, `TreeConnect(${targetSharePath})`, [STATUS_SUCCESS])
  console.log(`[SMB2] Tree connected: ${targetSharePath}, treeId=${treeResp.treeId}`)

  return { transport, sessionId, signingKey, treeId: treeResp.treeId, filePath: actualFilePath }
}

function parseDfsReferralResponse(body: Buffer): DfsTarget {
  // IOCTL response layout:
  //   0: StructureSize(2) + Reserved(2) + CtlCode(4) + FileId(16) = 24 bytes
  //  24: InputOffset(4) + InputCount(4)    = 8 bytes
  //  32: OutputOffset(4) + OutputCount(4)  = 8 bytes  ← these!
  //  40: Flags(4) + Reserved2(4)           = 8 bytes
  //  48: Buffer (variable)
  if (body.length < 40) throw new Error(`IOCTL response too small: ${body.length} bytes`)

  const outputOffset = body.readUInt32LE(32) - SMB2_HEADER_SIZE
  const outputCount = body.readUInt32LE(36)

  if (outputOffset < 0 || outputOffset + outputCount > body.length) {
    throw new Error(`IOCTL output bounds invalid: offset=${outputOffset}, count=${outputCount}, bodyLen=${body.length}`)
  }

  const output = body.subarray(outputOffset, outputOffset + outputCount)
  if (output.length < 8) throw new Error(`DFS referral response too small: ${output.length} bytes`)

  const pathConsumed = output.readUInt16LE(0) // bytes of UTF-16LE
  const numReferrals = output.readUInt16LE(2)
  // ReferralHeaderFlags at offset 4 (4 bytes)

  if (numReferrals === 0) throw new Error('No DFS referrals returned')

  // Parse first referral entry (starts at offset 8)
  const entryStart = 8
  if (entryStart + 4 > output.length) throw new Error('Referral entry header truncated')

  const version = output.readUInt16LE(entryStart)
  const entrySize = output.readUInt16LE(entryStart + 2)

  let networkAddress: string

  if (version === 3 || version === 4) {
    if (entryStart + 20 > output.length) throw new Error(`V${version} referral entry truncated (need 20 bytes)`)
    const entryFlags = output.readUInt16LE(entryStart + 6)
    if (entryFlags & 0x0002) {
      // NameListReferral — use SpecialName
      const specialNameOffset = output.readUInt16LE(entryStart + 12)
      networkAddress = readUtf16NullTerminated(output, entryStart + specialNameOffset)
    } else {
      const netAddrOffset = output.readUInt16LE(entryStart + 18)
      networkAddress = readUtf16NullTerminated(output, entryStart + netAddrOffset)
    }
  } else if (version === 1) {
    // V1: VersionNumber(2) + Size(2) + ServerType(2) + ReferralEntryFlags(2) + then UTF-16LE string
    networkAddress = readUtf16NullTerminated(output, entryStart + 8)
  } else {
    throw new Error(`Unsupported DFS referral version: ${version}`)
  }

  console.log(`[SMB2] DFS referral v${version}: "${networkAddress}", pathConsumed=${pathConsumed}b, entries=${numReferrals}`)

  const cleaned = networkAddress.replace(/^\\+/, '')
  const parts = cleaned.split('\\')
  return {
    server: parts[0],
    share: parts[1] || '',
    pathConsumed: pathConsumed / 2, // convert UTF-16LE bytes to chars
  }
}

function readUtf16NullTerminated(buf: Buffer, offset: number): string {
  if (offset < 0 || offset >= buf.length) return ''
  let end = offset
  while (end + 1 < buf.length) {
    if (buf[end] === 0 && buf[end + 1] === 0) break
    end += 2
  }
  return buf.subarray(offset, end).toString('utf16le')
}

// ═══════════════════════════════════════════════════════════════
// SMB2 Client — Public API
// ═══════════════════════════════════════════════════════════════

export interface Smb2ClientConfig {
  host: string
  port?: number
  domain: string
  username: string
  password: string
  share: string
  timeout?: number
}

export async function readFile(config: Smb2ClientConfig, filePath: string): Promise<Buffer> {
  const port = config.port ?? 445
  const timeout = config.timeout ?? 30_000

  let { transport, sessionId, signingKey } = await connectAndAuth(
    config.host, port, timeout, config.domain, config.username, config.password,
  )

  try {
    // Try TreeConnect to the requested share
    const sharePath = `\\\\${config.host}\\${config.share}`
    const treeResp = await signedSend(
      transport, SMB2_TREE_CONNECT, buildTreeConnectBody(sharePath),
      signingKey, { sessionId },
    )

    let treeId: number
    let actualFilePath = filePath

    if (treeResp.status === STATUS_BAD_NETWORK_NAME) {
      // DFS namespace — resolve via multi-level referral
      console.log(`[SMB2] Share "${config.share}" not found, attempting DFS resolution...`)
      const dfs = await resolveDfs(
        transport, sessionId, signingKey,
        config.host, config.share, filePath,
        port, timeout, config.domain, config.username, config.password,
      )
      transport = dfs.transport
      sessionId = dfs.sessionId
      signingKey = dfs.signingKey
      treeId = dfs.treeId
      actualFilePath = dfs.filePath
    } else {
      assertStatus(treeResp, 'TreeConnect', [STATUS_SUCCESS])
      treeId = treeResp.treeId
      console.log(`[SMB2] Tree connected: ${sharePath}, treeId=${treeId}`)
    }

    // ── Create (open file) ──
    const normalizedPath = actualFilePath.replace(/\//g, '\\').replace(/^\\+/, '')
    const createBody = buildCreateBody(normalizedPath)
    const createResp = await signedSend(
      transport, SMB2_CREATE, createBody,
      signingKey, { sessionId, treeId },
    )
    assertStatus(createResp, `Create(${normalizedPath})`, [STATUS_SUCCESS])

    const fileId = Buffer.from(createResp.body.subarray(64, 80))
    const fileSize = Number(createResp.body.readBigUInt64LE(48))
    console.log(`[SMB2] File opened: ${normalizedPath}, size=${fileSize}`)

    // ── Read ──
    const chunks: Buffer[] = []
    let readOffset = 0
    const maxReadSize = 65536

    while (readOffset < fileSize) {
      const readLen = Math.min(maxReadSize, fileSize - readOffset)
      const readBody = buildReadBody(fileId, readOffset, readLen)
      const readResp = await signedSend(
        transport, SMB2_READ, readBody,
        signingKey, { sessionId, treeId },
      )
      assertStatus(readResp, `Read(offset=${readOffset})`, [STATUS_SUCCESS])

      const dataOffset = readResp.body.readUInt8(2) - SMB2_HEADER_SIZE
      const dataLength = readResp.body.readUInt32LE(4)
      chunks.push(Buffer.from(readResp.body.subarray(dataOffset, dataOffset + dataLength)))
      readOffset += dataLength
    }

    // ── Close ──
    const closeBody = buildCloseBody(fileId)
    await signedSend(transport, SMB2_CLOSE, closeBody, signingKey, { sessionId, treeId })

    transport.close()
    return Buffer.concat(chunks)
  } catch (err) {
    transport.close()
    throw err
  }
}

// ═══════════════════════════════════════════════════════════════
// SMB2 Body Builders
// ═══════════════════════════════════════════════════════════════

function buildNegotiateBody(): Buffer {
  const dialects = [SMB2_DIALECT_0202, SMB2_DIALECT_0210]
  const body = Buffer.alloc(36 + dialects.length * 2)
  body.writeUInt16LE(36, 0) // StructureSize
  body.writeUInt16LE(dialects.length, 2) // DialectCount
  body.writeUInt16LE(1, 4) // SecurityMode (signing enabled)
  const guid = randomBytes(16)
  guid.copy(body, 12)
  for (let i = 0; i < dialects.length; i++) {
    body.writeUInt16LE(dialects[i], 36 + i * 2)
  }
  return body
}

function buildSessionSetupBody(securityBuffer: Buffer): Buffer {
  const body = Buffer.alloc(24 + securityBuffer.length)
  body.writeUInt16LE(25, 0) // StructureSize
  body.writeUInt8(1, 3) // SecurityMode
  body.writeUInt32LE(1, 4) // Capabilities (DFS)
  body.writeUInt16LE(SMB2_HEADER_SIZE + 24, 12) // SecurityBufferOffset = 88
  body.writeUInt16LE(securityBuffer.length, 14) // SecurityBufferLength
  securityBuffer.copy(body, 24)
  return body
}

function buildTreeConnectBody(path: string): Buffer {
  const pathBuf = Buffer.from(path, 'utf16le')
  const body = Buffer.alloc(8 + pathBuf.length)
  body.writeUInt16LE(9, 0) // StructureSize
  body.writeUInt16LE(SMB2_HEADER_SIZE + 8, 4) // PathOffset = 72
  body.writeUInt16LE(pathBuf.length, 6) // PathLength
  pathBuf.copy(body, 8)
  return body
}

function buildCreateBody(fileName: string): Buffer {
  const nameBuf = Buffer.from(fileName, 'utf16le')
  const body = Buffer.alloc(56 + nameBuf.length)
  body.writeUInt16LE(57, 0) // StructureSize
  body.writeUInt32LE(2, 4) // ImpersonationLevel = Impersonation
  body.writeUInt32LE(FILE_READ_DATA | FILE_READ_ATTRIBUTES, 24) // DesiredAccess
  body.writeUInt32LE(0x00000080, 28) // FileAttributes = NORMAL
  body.writeUInt32LE(FILE_SHARE_READ, 32) // ShareAccess
  body.writeUInt32LE(FILE_OPEN, 36) // CreateDisposition = FILE_OPEN
  body.writeUInt16LE(SMB2_HEADER_SIZE + 56, 44) // NameOffset = 120
  body.writeUInt16LE(nameBuf.length, 46) // NameLength
  nameBuf.copy(body, 56)
  return body
}

function buildReadBody(fileId: Buffer, offset: number, length: number): Buffer {
  const body = Buffer.alloc(49)
  body.writeUInt16LE(49, 0) // StructureSize
  body.writeUInt32LE(length, 4) // Length
  body.writeBigUInt64LE(BigInt(offset), 8) // Offset
  fileId.copy(body, 16) // FileId
  body.writeUInt32LE(1, 32) // MinimumCount
  return body
}

function buildCloseBody(fileId: Buffer): Buffer {
  const body = Buffer.alloc(24)
  body.writeUInt16LE(24, 0) // StructureSize
  fileId.copy(body, 8)
  return body
}

function buildIoctlDfsBody(dfsPath: string): Buffer {
  // REQ_GET_DFS_REFERRAL: MaxReferralLevel(2) + RequestFileName (UTF-16LE null-terminated)
  const pathBuf = Buffer.from(dfsPath + '\0', 'utf16le')
  const inputBuf = Buffer.alloc(2 + pathBuf.length)
  inputBuf.writeUInt16LE(3, 0) // MaxReferralLevel = 3
  pathBuf.copy(inputBuf, 2)

  // SMB2 IOCTL body: 56 bytes fixed + inputBuf
  const fileId = Buffer.alloc(16, 0xff) // sentinel FileId for IPC$ IOCTL
  const body = Buffer.alloc(56 + inputBuf.length)
  body.writeUInt16LE(57, 0) // StructureSize
  // Reserved(2) = 0
  body.writeUInt32LE(FSCTL_DFS_GET_REFERRALS, 4) // CtlCode
  fileId.copy(body, 8) // FileId (16 bytes)
  body.writeUInt32LE(SMB2_HEADER_SIZE + 56, 24) // InputOffset
  body.writeUInt32LE(inputBuf.length, 28) // InputCount
  body.writeUInt32LE(0, 32) // MaxInputResponse
  body.writeUInt32LE(0, 36) // OutputOffset (filled by server)
  body.writeUInt32LE(0, 40) // OutputCount
  body.writeUInt32LE(65536, 44) // MaxOutputResponse
  body.writeUInt32LE(SMB2_0_IOCTL_IS_FSCTL, 48) // Flags
  // Reserved2(4) = 0
  inputBuf.copy(body, 56)
  return body
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function extractSecurityBuffer(body: Buffer): Buffer {
  const offset = body.readUInt16LE(4) - SMB2_HEADER_SIZE
  const length = body.readUInt16LE(6)
  return Buffer.from(body.subarray(offset, offset + length))
}

function assertStatus(resp: SmB2Response, operation: string, allowed: number[]) {
  if (!allowed.includes(resp.status)) {
    const hex = '0x' + (resp.status >>> 0).toString(16).padStart(8, '0')
    throw new Error(`SMB2 ${operation} failed: status ${hex}`)
  }
}
