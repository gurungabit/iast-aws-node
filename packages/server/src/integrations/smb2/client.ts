/**
 * Lightweight SMB2 client — connect, authenticate (NTLM), read files.
 * Implements only the subset of SMB2 needed for reading 412 files.
 */

import { Socket } from 'net'
import { createType1, createType3, wrapSpnego, wrapSpnegoAuth } from './ntlm.js'

// SMB2 command codes
const SMB2_NEGOTIATE = 0x0000
const SMB2_SESSION_SETUP = 0x0001
const SMB2_TREE_CONNECT = 0x0003
const SMB2_TREE_DISCONNECT = 0x0004
const SMB2_CREATE = 0x0005
const SMB2_CLOSE = 0x0008
const SMB2_READ = 0x0009
const SMB2_QUERY_DIRECTORY = 0x000e
const SMB2_LOGOFF = 0x0002

// SMB2 header
const SMB2_HEADER_SIZE = 64
const SMB2_MAGIC = Buffer.from([0xfe, 0x53, 0x4d, 0x42]) // 0xFE 'S' 'M' 'B'

// Status codes
const STATUS_SUCCESS = 0x00000000
const STATUS_MORE_PROCESSING_REQUIRED = 0xc0000016
const STATUS_END_OF_FILE = 0xc0000011
const STATUS_NO_MORE_FILES = 0x80000006

// Common NT status code names for error messages
const STATUS_NAMES: Record<number, string> = {
  0xc000000d: 'STATUS_INVALID_PARAMETER',
  0xc0000022: 'STATUS_ACCESS_DENIED',
  0xc000006d: 'STATUS_LOGON_FAILURE',
  0xc0000034: 'STATUS_OBJECT_NAME_NOT_FOUND',
  0xc000003a: 'STATUS_OBJECT_PATH_NOT_FOUND',
  0xc00000ba: 'STATUS_FILE_IS_A_DIRECTORY',
  0xc0000257: 'STATUS_PATH_NOT_COVERED',
  0xc000005e: 'STATUS_NO_LOGON_SERVERS',
}

// Access/share/disposition constants for CREATE
const FILE_READ_DATA = 0x00000001
const FILE_READ_ATTRIBUTES = 0x00000080
const FILE_SHARE_READ = 0x00000001
const FILE_OPEN = 0x00000001 // Open existing
const FILE_NON_DIRECTORY_FILE = 0x00000040
const FILE_DIRECTORY_FILE = 0x00000001
const FILE_LIST_DIRECTORY = 0x00000001

// FileInformationClass for QUERY_DIRECTORY
const FILE_ID_BOTH_DIR_INFORMATION = 0x25

export interface DirEntry {
  name: string
  isDirectory: boolean
  size: bigint
}

export interface SMB2Options {
  host: string
  port?: number
  share: string
  domain?: string
  username: string
  password: string
  timeout?: number
}

export class SMB2Client {
  private socket: Socket | null = null
  private messageId = 0n
  private sessionId = 0n
  private treeId = 0
  private pendingResponses = new Map<bigint, {
    resolve: (buf: Buffer) => void
    reject: (err: Error) => void
  }>()
  private recvBuffer = Buffer.alloc(0)
  private connected = false
  private isDfs = false

  async connect(opts: SMB2Options): Promise<void> {
    const port = opts.port ?? 445
    const timeout = opts.timeout ?? 30_000

    // TCP connect
    await this.tcpConnect(opts.host, port, timeout)

    // SMB2 Negotiate
    await this.negotiate()

    // Session Setup (NTLM)
    await this.sessionSetup(opts.username, opts.password, opts.domain ?? '')

    // Tree Connect
    await this.treeConnect(opts.host, opts.share)
  }

  async readFile(path: string): Promise<Buffer> {
    // Normalize path separators
    const smbPath = path.replace(/\//g, '\\')

    // CREATE (open file)
    const fileId = await this.createFile(smbPath)

    try {
      // READ loop
      const chunks: Buffer[] = []
      let offset = 0n
      const chunkSize = 65536

      while (true) {
        const { data, eof } = await this.readChunk(fileId, offset, chunkSize)
        if (data.length > 0) {
          chunks.push(data)
          offset += BigInt(data.length)
        }
        if (eof || data.length === 0) break
      }

      return Buffer.concat(chunks)
    } finally {
      await this.closeFile(fileId)
    }
  }

  async listDir(path: string): Promise<DirEntry[]> {
    const smbPath = path.replace(/\//g, '\\')

    // Open directory handle
    const dirId = await this.openDirectory(smbPath)

    try {
      const entries: DirEntry[] = []
      let firstQuery = true

      while (true) {
        const result = await this.queryDirectory(dirId, '*', firstQuery)
        firstQuery = false
        if (!result) break
        entries.push(...parseDirEntries(result))
      }

      // Filter out . and ..
      return entries.filter((e) => e.name !== '.' && e.name !== '..')
    } finally {
      await this.closeFile(dirId)
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return

    try {
      if (this.treeId) await this.treeDisconnect()
      if (this.sessionId) await this.logoff()
    } catch {
      // best effort
    } finally {
      this.socket?.destroy()
      this.socket = null
      this.connected = false
    }
  }

  // --- Transport ---

  private tcpConnect(host: string, port: number, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new Socket()
      const timer = setTimeout(() => {
        socket.destroy()
        reject(new Error(`SMB2 connection to ${host}:${port} timed out`))
      }, timeout)

      socket.connect(port, host, () => {
        clearTimeout(timer)
        this.socket = socket
        this.connected = true

        socket.on('data', (data: Buffer) => this.onData(data))
        socket.on('error', (err) => this.onError(err))
        socket.on('close', () => { this.connected = false })

        resolve()
      })

      socket.on('error', (err) => {
        clearTimeout(timer)
        reject(new Error(`SMB2 connection failed: ${err.message}`))
      })
    })
  }

  private onData(data: Buffer): void {
    this.recvBuffer = Buffer.concat([this.recvBuffer, data])

    while (this.recvBuffer.length >= 4) {
      // NetBIOS session header: 4 bytes (1 byte type + 3 bytes length)
      const nbLen = (this.recvBuffer[1] << 16) | (this.recvBuffer[2] << 8) | this.recvBuffer[3]
      const totalLen = 4 + nbLen

      if (this.recvBuffer.length < totalLen) break

      const packet = this.recvBuffer.subarray(4, totalLen)
      this.recvBuffer = Buffer.from(this.recvBuffer.subarray(totalLen))

      this.handlePacket(packet)
    }
  }

  private handlePacket(packet: Buffer): void {
    if (packet.length < SMB2_HEADER_SIZE) return
    if (!packet.subarray(0, 4).equals(SMB2_MAGIC)) return

    const msgId = packet.readBigUInt64LE(24)
    const pending = this.pendingResponses.get(msgId)
    if (pending) {
      this.pendingResponses.delete(msgId)
      pending.resolve(packet)
    }
  }

  private onError(err: Error): void {
    for (const [, pending] of this.pendingResponses) {
      pending.reject(err)
    }
    this.pendingResponses.clear()
  }

  private sendRequest(command: number, payload: Buffer, extraFlags = 0): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        return reject(new Error('Not connected'))
      }

      const msgId = this.messageId++
      const header = this.buildHeader(command, msgId, extraFlags)
      const smb2Packet = Buffer.concat([header, payload])

      // NetBIOS session header
      const nbHeader = Buffer.alloc(4)
      nbHeader[0] = 0x00
      nbHeader[1] = (smb2Packet.length >> 16) & 0xff
      nbHeader[2] = (smb2Packet.length >> 8) & 0xff
      nbHeader[3] = smb2Packet.length & 0xff

      this.pendingResponses.set(msgId, { resolve, reject })

      const timer = setTimeout(() => {
        this.pendingResponses.delete(msgId)
        reject(new Error(`SMB2 request timeout (command: 0x${command.toString(16)})`))
      }, 30_000)

      this.pendingResponses.set(msgId, {
        resolve: (buf) => { clearTimeout(timer); resolve(buf) },
        reject: (err) => { clearTimeout(timer); reject(err) },
      })

      this.socket.write(Buffer.concat([nbHeader, smb2Packet]))
    })
  }

  private buildHeader(command: number, messageId: bigint, extraFlags = 0): Buffer {
    const header = Buffer.alloc(SMB2_HEADER_SIZE)
    SMB2_MAGIC.copy(header, 0)
    header.writeUInt16LE(64, 4)     // StructureSize
    header.writeUInt16LE(0, 6)      // CreditCharge
    header.writeUInt32LE(0, 8)      // Status
    header.writeUInt16LE(command, 12) // Command
    header.writeUInt16LE(1, 14)     // CreditRequest
    header.writeUInt32LE(extraFlags, 16) // Flags
    header.writeUInt32LE(0, 20)     // NextCommand
    header.writeBigUInt64LE(messageId, 24) // MessageId
    header.writeUInt32LE(0xFEFF, 32) // Reserved (ProcessId)
    header.writeUInt32LE(this.treeId, 36) // TreeId
    header.writeBigUInt64LE(this.sessionId, 40) // SessionId
    // Signature (16 bytes at offset 48) left as zeros
    return header
  }

  private checkStatus(response: Buffer, allowedStatuses: number[] = [STATUS_SUCCESS], context?: string): number {
    const status = response.readUInt32LE(8)
    if (!allowedStatuses.includes(status)) {
      const statusHex = `0x${status.toString(16).padStart(8, '0')}`
      const statusName = STATUS_NAMES[status] ?? 'UNKNOWN'
      const ctx = context ? ` during ${context}` : ''
      throw new Error(`SMB2 error${ctx}: ${statusHex} (${statusName})`)
    }
    return status
  }

  // --- Protocol Operations ---

  private async negotiate(): Promise<void> {
    // SMB2 Negotiate request
    const payload = Buffer.alloc(36)
    payload.writeUInt16LE(36, 0)   // StructureSize
    payload.writeUInt16LE(2, 2)    // DialectCount
    payload.writeUInt16LE(1, 4)    // SecurityMode (signing enabled)
    // Capabilities, ClientGuid left as zeros
    // Dialects at offset 36
    const dialects = Buffer.alloc(4)
    dialects.writeUInt16LE(0x0202, 0) // SMB 2.0.2
    dialects.writeUInt16LE(0x0210, 2) // SMB 2.1

    const response = await this.sendRequest(SMB2_NEGOTIATE, Buffer.concat([payload, dialects]))
    this.checkStatus(response, [STATUS_SUCCESS], 'negotiate')
  }

  private async sessionSetup(username: string, password: string, domain: string): Promise<void> {
    // Round 1: Send NTLM Type 1 (Negotiate)
    const type1 = createType1()
    const spnegoInit = wrapSpnego(type1)

    const setup1 = this.buildSessionSetup(spnegoInit)
    const response1 = await this.sendRequest(SMB2_SESSION_SETUP, setup1)
    this.checkStatus(response1, [STATUS_MORE_PROCESSING_REQUIRED], 'session setup (NTLM negotiate)')

    // Extract session ID from response
    this.sessionId = response1.readBigUInt64LE(40)

    // Extract NTLM Type 2 from SPNEGO response
    const secBufOffset1 = response1.readUInt16LE(SMB2_HEADER_SIZE + 4)
    const secBufLen1 = response1.readUInt16LE(SMB2_HEADER_SIZE + 6)
    const spnegoResponse = response1.subarray(secBufOffset1, secBufOffset1 + secBufLen1)
    console.log(`[SMB2] SPNEGO response: offset=${secBufOffset1}, len=${secBufLen1}, hex=${spnegoResponse.subarray(0, 40).toString('hex')}...`)
    const type2 = extractNtlmFromSpnego(spnegoResponse)
    console.log(`[SMB2] Type2 extracted: len=${type2.length}, hex=${type2.subarray(0, 48).toString('hex')}...`)

    // Round 2: Send NTLM Type 3 (Authenticate)
    const type3 = createType3(type1, type2, username, password, domain)
    const spnegoAuth = wrapSpnegoAuth(type3)

    const setup2 = this.buildSessionSetup(spnegoAuth)
    const response2 = await this.sendRequest(SMB2_SESSION_SETUP, setup2)
    this.checkStatus(response2, [STATUS_SUCCESS], 'session setup (NTLM authenticate)')
  }

  private buildSessionSetup(securityBuffer: Buffer): Buffer {
    const structSize = 25 // Fixed structure size for Session Setup
    const secBufOffset = SMB2_HEADER_SIZE + 24 // Offset from start of SMB2 header
    const payload = Buffer.alloc(24 + securityBuffer.length)
    payload.writeUInt16LE(structSize, 0)
    payload.writeUInt8(0, 2)          // Flags
    payload.writeUInt8(1, 3)          // SecurityMode
    payload.writeUInt32LE(0, 4)       // Capabilities
    payload.writeUInt32LE(0, 8)       // Channel
    payload.writeUInt16LE(secBufOffset, 12) // SecurityBufferOffset
    payload.writeUInt16LE(securityBuffer.length, 14) // SecurityBufferLength
    // PreviousSessionId (8 bytes at offset 16) left as zero
    securityBuffer.copy(payload, 24)
    return payload
  }

  private async treeConnect(host: string, share: string): Promise<void> {
    // Path: \\host\share
    const pathStr = `\\\\${host}\\${share}`
    const pathBuf = Buffer.from(pathStr, 'utf16le')

    const payload = Buffer.alloc(8 + pathBuf.length)
    payload.writeUInt16LE(9, 0)  // StructureSize
    payload.writeUInt16LE(0, 2)  // Reserved/Flags
    payload.writeUInt16LE(SMB2_HEADER_SIZE + 8, 4) // PathOffset
    payload.writeUInt16LE(pathBuf.length, 6) // PathLength
    pathBuf.copy(payload, 8)

    const response = await this.sendRequest(SMB2_TREE_CONNECT, payload)
    this.checkStatus(response, [STATUS_SUCCESS], `tree connect (${pathStr})`)

    this.treeId = response.readUInt32LE(36)

    // Detect DFS share (SMB2_SHAREFLAG_DFS = 0x00000001)
    const shareFlags = response.readUInt32LE(SMB2_HEADER_SIZE + 4)
    this.isDfs = (shareFlags & 0x00000001) !== 0
  }

  private async createFile(path: string): Promise<Buffer> {
    const nameBuf = Buffer.from(path, 'utf16le')

    // CREATE request structure (57 bytes fixed + name)
    const payload = Buffer.alloc(56 + nameBuf.length)
    payload.writeUInt16LE(57, 0)   // StructureSize
    payload.writeUInt8(0, 2)       // SecurityFlags
    payload.writeUInt8(0, 3)       // RequestedOplockLevel
    payload.writeUInt32LE(2, 4)    // ImpersonationLevel: SecurityImpersonation
    // SmbCreateFlags (8 bytes at offset 8) = 0
    // Reserved (8 bytes at offset 16) = 0
    payload.writeUInt32LE(FILE_READ_DATA | FILE_READ_ATTRIBUTES, 24) // DesiredAccess
    payload.writeUInt32LE(0, 28)   // FileAttributes
    payload.writeUInt32LE(FILE_SHARE_READ, 32) // ShareAccess
    payload.writeUInt32LE(FILE_OPEN, 36) // CreateDisposition
    payload.writeUInt32LE(FILE_NON_DIRECTORY_FILE, 40) // CreateOptions
    payload.writeUInt16LE(SMB2_HEADER_SIZE + 56, 44) // NameOffset
    payload.writeUInt16LE(nameBuf.length, 46)  // NameLength
    // CreateContextsOffset/Length (offset 48-55) = 0
    nameBuf.copy(payload, 56)

    // Set DFS flag if the share is a DFS namespace
    const flags = this.isDfs ? 0x10000000 : 0 // SMB2_FLAGS_DFS_OPERATIONS
    const response = await this.sendRequest(SMB2_CREATE, payload, flags)
    this.checkStatus(response, [STATUS_SUCCESS], `create file (${path})`)

    const fileId = Buffer.from(response.subarray(SMB2_HEADER_SIZE + 64, SMB2_HEADER_SIZE + 80))
    return fileId
  }

  private async readChunk(
    fileId: Buffer, offset: bigint, length: number,
  ): Promise<{ data: Buffer; eof: boolean }> {
    const payload = Buffer.alloc(49)
    payload.writeUInt16LE(49, 0)    // StructureSize
    payload.writeUInt8(0, 2)        // Padding
    payload.writeUInt8(0, 3)        // Flags
    payload.writeUInt32LE(length, 4) // Length
    payload.writeBigUInt64LE(offset, 8) // Offset
    fileId.copy(payload, 16)        // FileId (16 bytes)
    payload.writeUInt32LE(1, 32)    // MinimumCount
    // Channel, RemainingBytes, ReadChannelInfoOffset/Length = 0
    // Buffer (1 byte at offset 48 for padding)
    payload.writeUInt8(0, 48)

    const response = await this.sendRequest(SMB2_READ, payload)
    const status = response.readUInt32LE(8)

    if (status === STATUS_END_OF_FILE) {
      return { data: Buffer.alloc(0), eof: true }
    }

    this.checkStatus(response)

    const dataOffset = response.readUInt8(SMB2_HEADER_SIZE + 2)
    const dataLength = response.readUInt32LE(SMB2_HEADER_SIZE + 4)
    const data = Buffer.from(response.subarray(dataOffset, dataOffset + dataLength))

    return { data, eof: dataLength < length }
  }

  private async closeFile(fileId: Buffer): Promise<void> {
    const payload = Buffer.alloc(24)
    payload.writeUInt16LE(24, 0) // StructureSize
    payload.writeUInt16LE(0, 2)  // Flags
    // Reserved (4 bytes at offset 4) = 0
    fileId.copy(payload, 8)      // FileId (16 bytes)

    const response = await this.sendRequest(SMB2_CLOSE, payload)
    this.checkStatus(response)
  }

  private async openDirectory(path: string): Promise<Buffer> {
    const nameBuf = Buffer.from(path, 'utf16le')

    const payload = Buffer.alloc(56 + nameBuf.length)
    payload.writeUInt16LE(57, 0)   // StructureSize
    payload.writeUInt8(0, 2)       // SecurityFlags
    payload.writeUInt8(0, 3)       // RequestedOplockLevel
    payload.writeUInt32LE(2, 4)    // ImpersonationLevel: SecurityImpersonation
    payload.writeUInt32LE(FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES, 24) // DesiredAccess
    payload.writeUInt32LE(0, 28)   // FileAttributes
    payload.writeUInt32LE(FILE_SHARE_READ, 32) // ShareAccess
    payload.writeUInt32LE(FILE_OPEN, 36) // CreateDisposition
    payload.writeUInt32LE(FILE_DIRECTORY_FILE, 40) // CreateOptions
    payload.writeUInt16LE(SMB2_HEADER_SIZE + 56, 44) // NameOffset
    payload.writeUInt16LE(nameBuf.length, 46)  // NameLength
    nameBuf.copy(payload, 56)

    const flags = this.isDfs ? 0x10000000 : 0 // SMB2_FLAGS_DFS_OPERATIONS
    const response = await this.sendRequest(SMB2_CREATE, payload, flags)
    this.checkStatus(response, [STATUS_SUCCESS], `open directory (${path})`)

    return Buffer.from(response.subarray(SMB2_HEADER_SIZE + 64, SMB2_HEADER_SIZE + 80))
  }

  private async queryDirectory(
    fileId: Buffer, pattern: string, restart: boolean,
  ): Promise<Buffer | null> {
    const patternBuf = Buffer.from(pattern, 'utf16le')

    const payload = Buffer.alloc(32 + patternBuf.length)
    payload.writeUInt16LE(33, 0)  // StructureSize
    payload.writeUInt8(FILE_ID_BOTH_DIR_INFORMATION, 1) // FileInformationClass
    payload.writeUInt8(restart ? 0x01 : 0x00, 2) // Flags: SMB2_RESTART_SCANS on first call
    payload.writeUInt32LE(0, 4)   // FileIndex
    fileId.copy(payload, 8)       // FileId (16 bytes)
    payload.writeUInt16LE(SMB2_HEADER_SIZE + 32, 24) // FileNameOffset
    payload.writeUInt16LE(patternBuf.length, 26) // FileNameLength
    payload.writeUInt32LE(65536, 28) // OutputBufferLength
    patternBuf.copy(payload, 32)

    const response = await this.sendRequest(SMB2_QUERY_DIRECTORY, payload)
    const status = response.readUInt32LE(8)

    if (status === STATUS_NO_MORE_FILES) return null
    this.checkStatus(response)

    const outOffset = response.readUInt16LE(SMB2_HEADER_SIZE + 2)
    const outLength = response.readUInt32LE(SMB2_HEADER_SIZE + 4)
    return Buffer.from(response.subarray(outOffset, outOffset + outLength))
  }

  private async treeDisconnect(): Promise<void> {
    const payload = Buffer.alloc(4)
    payload.writeUInt16LE(4, 0) // StructureSize
    const response = await this.sendRequest(SMB2_TREE_DISCONNECT, payload)
    this.checkStatus(response)
    this.treeId = 0
  }

  private async logoff(): Promise<void> {
    const payload = Buffer.alloc(4)
    payload.writeUInt16LE(4, 0) // StructureSize
    const response = await this.sendRequest(SMB2_LOGOFF, payload)
    this.checkStatus(response)
    this.sessionId = 0n
  }
}

/** Parse FILE_ID_BOTH_DIR_INFORMATION entries from QUERY_DIRECTORY response */
function parseDirEntries(buf: Buffer): DirEntry[] {
  const entries: DirEntry[] = []
  let offset = 0

  while (offset < buf.length) {
    const nextOffset = buf.readUInt32LE(offset)
    const fileAttributes = buf.readUInt32LE(offset + 56)
    const fileNameLength = buf.readUInt32LE(offset + 60)
    // File name starts at offset + 104 in FILE_ID_BOTH_DIR_INFORMATION
    const name = buf.subarray(offset + 104, offset + 104 + fileNameLength).toString('utf16le')
    const size = buf.readBigUInt64LE(offset + 40) // EndOfFile

    entries.push({
      name,
      isDirectory: (fileAttributes & 0x10) !== 0, // FILE_ATTRIBUTE_DIRECTORY
      size,
    })

    if (nextOffset === 0) break
    offset += nextOffset
  }

  return entries
}

/** Extract NTLM token from SPNEGO wrapper (simple ASN.1 search) */
function extractNtlmFromSpnego(spnego: Buffer): Buffer {
  // Find NTLMSSP signature in the SPNEGO blob
  const sig = Buffer.from('NTLMSSP\0')
  const idx = spnego.indexOf(sig)
  if (idx === -1) {
    throw new Error('NTLMSSP token not found in SPNEGO response')
  }

  // The NTLM message extends to the end of the containing OCTET STRING.
  // Simple approach: find the NTLMSSP signature and extract everything from there
  // to determine the actual NTLM message length from the ASN.1 structure.
  // For robustness, we extract from the signature to the end of the buffer,
  // since NTLM Type 2 messages are self-describing (have internal length fields).
  return Buffer.from(spnego.subarray(idx))
}
