/**
 * Minimal SMB2 client: Negotiate → SessionSetup (SPNEGO/NTLMv2) → TreeConnect → Read → Close.
 *
 * Implements just enough of the SMB2 protocol to read files from a share.
 * Packet framing follows [MS-SMB2] with NetBIOS session header (4-byte length prefix).
 */

import { Socket } from 'net'
import { randomBytes } from 'crypto'
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

// Status codes
const STATUS_SUCCESS = 0x00000000
const STATUS_MORE_PROCESSING_REQUIRED = 0xc0000016
const STATUS_PENDING = 0x00000103

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

// ═══════════════════════════════════════════════════════════════
// SMB2 Packet Builder
// ═══════════════════════════════════════════════════════════════

let messageIdCounter = 0n

function buildSmb2Header(command: number, payloadLen: number, opts: {
  sessionId?: bigint
  treeId?: number
  creditCharge?: number
} = {}): Buffer {
  const hdr = Buffer.alloc(SMB2_HEADER_SIZE)
  SMB2_MAGIC.copy(hdr, 0)
  hdr.writeUInt16LE(SMB2_HEADER_SIZE, 4) // StructureSize
  hdr.writeUInt16LE(opts.creditCharge ?? 1, 6) // CreditCharge
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
  // NetBIOS session header: 4-byte big-endian length prefix
  const nb = Buffer.alloc(4)
  nb.writeUInt32BE(pkt.length, 0)
  return Buffer.concat([nb, pkt])
}

// ═══════════════════════════════════════════════════════════════
// SMB2 Packet Parsers
// ═══════════════════════════════════════════════════════════════

interface SmB2Response {
  status: number
  command: number
  sessionId: bigint
  treeId: number
  body: Buffer // everything after the 64-byte header
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

      // Check if data already buffered
      this.tryDeliver()
    })
  }

  close() {
    this.closed = true
    try { this.socket.destroy() } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════
// SMB2 Client
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
  const transport = new Smb2Transport(config.host, port, timeout)

  // Reset message ID counter for each connection
  messageIdCounter = 0n

  try {
    await transport.connect()

    // ── Step 1: Negotiate ──
    const negotiateBody = buildNegotiateBody()
    const negHdr = buildSmb2Header(SMB2_NEGOTIATE, negotiateBody.length)
    const negResp = parseResponse(await transport.send(framePacket(negHdr, negotiateBody)))
    assertStatus(negResp, 'Negotiate', [STATUS_SUCCESS])

    // ── Step 2: Session Setup (NTLM Type 1) ──
    const type1Raw = createType1()
    const spnegoInit = wrapSpnegoInit(type1Raw)
    const ss1Body = buildSessionSetupBody(spnegoInit)
    const ss1Hdr = buildSmb2Header(SMB2_SESSION_SETUP, ss1Body.length)
    const ss1Resp = parseResponse(await transport.send(framePacket(ss1Hdr, ss1Body)))
    assertStatus(ss1Resp, 'SessionSetup1', [STATUS_MORE_PROCESSING_REQUIRED])

    const sessionId = ss1Resp.sessionId

    // Extract Type 2 from response
    const ss1SecurityBuf = extractSecurityBuffer(ss1Resp.body)
    const type2Raw = extractNtlmToken(ss1SecurityBuf)
    const type2Info = parseType2(type2Raw)

    // Use server's NetBIOS domain from TargetInfo for NTOWFv2
    const serverDomain = getNetBiosDomain(type2Info.targetInfo) || config.domain
    console.log(`[SMB2] Server NetBIOS domain: "${serverDomain}", using for NTOWFv2`)

    // ── Step 3: Session Setup (NTLM Type 3 with MIC) ──
    const { type3 } = createType3(
      type1Raw,
      type2Info,
      config.username,
      config.password,
      serverDomain,
    )
    const spnegoAuth = wrapSpnegoAuth(type3)
    const ss2Body = buildSessionSetupBody(spnegoAuth)
    const ss2Hdr = buildSmb2Header(SMB2_SESSION_SETUP, ss2Body.length, { sessionId })
    const ss2Resp = parseResponse(await transport.send(framePacket(ss2Hdr, ss2Body)))
    assertStatus(ss2Resp, 'SessionSetup2', [STATUS_SUCCESS])

    console.log(`[SMB2] Authentication successful, sessionId=${sessionId}`)

    // ── Step 4: Tree Connect ──
    const sharePath = `\\\\${config.host}\\${config.share}`
    const treeBody = buildTreeConnectBody(sharePath)
    const treeHdr = buildSmb2Header(SMB2_TREE_CONNECT, treeBody.length, { sessionId })
    const treeResp = parseResponse(await transport.send(framePacket(treeHdr, treeBody)))
    assertStatus(treeResp, 'TreeConnect', [STATUS_SUCCESS])

    const treeId = treeResp.treeId
    console.log(`[SMB2] Tree connected: ${sharePath}, treeId=${treeId}`)

    // ── Step 5: Create (open file) ──
    // Normalize path separators
    const normalizedPath = filePath.replace(/\//g, '\\').replace(/^\\+/, '')
    const createBody = buildCreateBody(normalizedPath)
    const createHdr = buildSmb2Header(SMB2_CREATE, createBody.length, { sessionId, treeId })
    const createResp = parseResponse(await transport.send(framePacket(createHdr, createBody)))
    assertStatus(createResp, `Create(${normalizedPath})`, [STATUS_SUCCESS])

    // Parse Create response to get FileId (16 bytes at offset 64 of body)
    // StructureSize(2) + OplockLevel(1) + Flags(1) + CreateAction(4) + CreationTime(8) +
    // LastAccessTime(8) + LastWriteTime(8) + ChangeTime(8) + AllocationSize(8) + EndofFile(8) +
    // FileAttributes(4) + Reserved2(4) = 64
    const fileId = Buffer.from(createResp.body.subarray(64, 80)) // persistent + volatile file ID
    const fileSize = Number(createResp.body.readBigUInt64LE(48)) // EndofFile

    console.log(`[SMB2] File opened: ${normalizedPath}, size=${fileSize}`)

    // ── Step 6: Read ──
    const chunks: Buffer[] = []
    let readOffset = 0
    const maxReadSize = 65536 // 64KB per read

    while (readOffset < fileSize) {
      const readLen = Math.min(maxReadSize, fileSize - readOffset)
      const readBody = buildReadBody(fileId, readOffset, readLen)
      const readHdr = buildSmb2Header(SMB2_READ, readBody.length, { sessionId, treeId })
      const readResp = parseResponse(await transport.send(framePacket(readHdr, readBody)))
      assertStatus(readResp, `Read(offset=${readOffset})`, [STATUS_SUCCESS])

      // Parse Read response: StructureSize(2) + DataOffset(1) + Reserved(1) + DataLength(4)
      const dataOffset = readResp.body.readUInt8(2) - SMB2_HEADER_SIZE // relative to response start
      const dataLength = readResp.body.readUInt32LE(4)
      chunks.push(Buffer.from(readResp.body.subarray(dataOffset, dataOffset + dataLength)))
      readOffset += dataLength
    }

    // ── Step 7: Close ──
    const closeBody = buildCloseBody(fileId)
    const closeHdr = buildSmb2Header(SMB2_CLOSE, closeBody.length, { sessionId, treeId })
    await transport.send(framePacket(closeHdr, closeBody))
    // Don't check status — best effort close

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
  // Reserved (2 bytes at 6)
  // Capabilities (4 bytes at 8) = 0
  // ClientGuid (16 bytes at 12)
  const guid = randomBytes(16)
  guid.copy(body, 12)
  // ClientStartTime (8 bytes at 28) = 0
  for (let i = 0; i < dialects.length; i++) {
    body.writeUInt16LE(dialects[i], 36 + i * 2)
  }
  return body
}

function buildSessionSetupBody(securityBuffer: Buffer): Buffer {
  // StructureSize(2) + Flags(1) + SecurityMode(1) + Capabilities(4) +
  // Channel(4) + SecurityBufferOffset(2) + SecurityBufferLength(2) + PreviousSessionId(8) = 24 fixed
  // SecurityBufferOffset = 64 (header) + 24 (body fixed) = 88
  const body = Buffer.alloc(24 + securityBuffer.length)
  body.writeUInt16LE(25, 0) // StructureSize (25 per spec, odd = includes variable part)
  // Flags = 0, SecurityMode = 1
  body.writeUInt8(1, 3) // SecurityMode
  body.writeUInt32LE(1, 4) // Capabilities (DFS)
  // Channel = 0
  body.writeUInt16LE(SMB2_HEADER_SIZE + 24, 12) // SecurityBufferOffset = 88
  body.writeUInt16LE(securityBuffer.length, 14) // SecurityBufferLength
  // PreviousSessionId = 0
  securityBuffer.copy(body, 24)
  return body
}

function buildTreeConnectBody(path: string): Buffer {
  const pathBuf = Buffer.from(path, 'utf16le')
  // StructureSize(2) + Reserved(2) + PathOffset(2) + PathLength(2) = 8 fixed
  // PathOffset = 64 (header) + 8 (body fixed) = 72
  const body = Buffer.alloc(8 + pathBuf.length)
  body.writeUInt16LE(9, 0) // StructureSize
  // Reserved = 0
  body.writeUInt16LE(SMB2_HEADER_SIZE + 8, 4) // PathOffset = 72
  body.writeUInt16LE(pathBuf.length, 6) // PathLength
  pathBuf.copy(body, 8)
  return body
}

function buildCreateBody(fileName: string): Buffer {
  const nameBuf = Buffer.from(fileName, 'utf16le')
  // Fixed part: 56 bytes
  // StructureSize(2) + SecurityFlags(1) + RequestedOplockLevel(1) + ImpersonationLevel(4) +
  // SmbCreateFlags(8) + Reserved(8) + DesiredAccess(4) + FileAttributes(4) +
  // ShareAccess(4) + CreateDisposition(4) + CreateOptions(4) +
  // NameOffset(2) + NameLength(2) + CreateContextsOffset(4) + CreateContextsLength(4) = 56
  const body = Buffer.alloc(56 + nameBuf.length)
  body.writeUInt16LE(57, 0) // StructureSize
  // SecurityFlags = 0, RequestedOplockLevel = 0 (none)
  body.writeUInt32LE(2, 4) // ImpersonationLevel = Impersonation
  // SmbCreateFlags = 0, Reserved = 0
  body.writeUInt32LE(FILE_READ_DATA | FILE_READ_ATTRIBUTES, 24) // DesiredAccess
  body.writeUInt32LE(0x00000080, 28) // FileAttributes = NORMAL
  body.writeUInt32LE(FILE_SHARE_READ, 32) // ShareAccess
  body.writeUInt32LE(FILE_OPEN, 36) // CreateDisposition = FILE_OPEN
  // CreateOptions = 0 (we're reading a file)
  body.writeUInt16LE(SMB2_HEADER_SIZE + 56, 44) // NameOffset = 120
  body.writeUInt16LE(nameBuf.length, 46) // NameLength
  // CreateContextsOffset = 0, CreateContextsLength = 0
  nameBuf.copy(body, 56)
  return body
}

function buildReadBody(fileId: Buffer, offset: number, length: number): Buffer {
  // StructureSize(2) + Padding(1) + Flags(1) + Length(4) + Offset(8) +
  // FileId(16) + MinimumCount(4) + Channel(4) + RemainingBytes(4) +
  // ReadChannelInfoOffset(2) + ReadChannelInfoLength(2) + Buffer(1) = 49
  const body = Buffer.alloc(49)
  body.writeUInt16LE(49, 0) // StructureSize
  // Padding = 0, Flags = 0
  body.writeUInt32LE(length, 4) // Length
  body.writeBigUInt64LE(BigInt(offset), 8) // Offset
  fileId.copy(body, 16) // FileId (16 bytes)
  body.writeUInt32LE(1, 32) // MinimumCount
  // Channel = 0, RemainingBytes = 0
  // ReadChannelInfoOffset = 0, ReadChannelInfoLength = 0
  // Buffer = 0x00 (1 byte padding)
  return body
}

function buildCloseBody(fileId: Buffer): Buffer {
  // StructureSize(2) + Flags(2) + Reserved(4) + FileId(16) = 24
  const body = Buffer.alloc(24)
  body.writeUInt16LE(24, 0) // StructureSize
  // Flags = 0, Reserved = 0
  fileId.copy(body, 8) // FileId
  return body
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function extractSecurityBuffer(body: Buffer): Buffer {
  // SessionSetup response: StructureSize(2) + SessionFlags(2) + SecurityBufferOffset(2) + SecurityBufferLength(2) + Buffer...
  const offset = body.readUInt16LE(4) - SMB2_HEADER_SIZE // SecurityBufferOffset is from packet start
  const length = body.readUInt16LE(6)
  return Buffer.from(body.subarray(offset, offset + length))
}

function assertStatus(resp: SmB2Response, operation: string, allowed: number[]) {
  if (!allowed.includes(resp.status)) {
    const hex = '0x' + (resp.status >>> 0).toString(16).padStart(8, '0')
    throw new Error(`SMB2 ${operation} failed: status ${hex}`)
  }
}
