# SMB2 Client — Custom SPNEGO/NTLMv2 Implementation

## Why a Custom Client?

The npm SMB2 libraries (`@marsaud/smb2`, `@awo00/smb2`, etc.) fail against our target
file server (`\\Opr.statefarm.org\dfs`) because they:

1. Send raw NTLM tokens — server requires **SPNEGO/GSS-API wrapping** (returns `STATUS_NOT_SUPPORTED`)
2. Don't compute a **MIC** (Message Integrity Code) — server returns `STATUS_USER_SESSION_DELETED`
3. Use OpenSSL's RC4/DES-ECB/MD4 — all **disabled in Node.js v24+ (OpenSSL 3.x)**
4. Don't handle **DFS namespace referrals** — `dfs` is a namespace, not a regular share

This client implements the minimum SMB2 protocol needed to read files, with correct
authentication for enterprise Windows environments.

---

## Architecture

```
readFile(config, path)
  |
  +-- connectAndAuth(host)         TCP + Negotiate + SessionSetup (SPNEGO/NTLMv2)
  |
  +-- TreeConnect(share)           Try direct share access
  |     |
  |     +-- STATUS_BAD_NETWORK_NAME?  --> resolveDfs()
  |
  +-- resolveDfs()                 Multi-level DFS referral resolution
  |     |
  |     +-- TreeConnect(IPC$)      Connect to IPC$ for IOCTL
  |     +-- IOCTL(FSCTL_DFS_GET_REFERRALS)  Root referral --> namespace server
  |     +-- connectAndAuth(namespace server)
  |     +-- IOCTL(FSCTL_DFS_GET_REFERRALS)  Link referral --> file server
  |     +-- connectAndAuth(file server)
  |     +-- TreeConnect(target share)
  |
  +-- CREATE(file)                 Open file (FILE_OPEN, read-only)
  +-- READ loop                    64KB chunks, signed
  +-- CLOSE(file)
```

---

## Files

| File | Purpose |
|------|---------|
| `client.ts` | SMB2 transport, packet builder/parser, DFS resolution, file read |
| `ntlm.ts` | NTLMv2 auth: Type1/Type2/Type3 messages, SPNEGO wrapping, MIC |
| `../smb.ts` | High-level wrapper: parses share URLs, splits `DOMAIN\user`, calls `readFile()` |

---

## Authentication Flow

### SPNEGO Wrapping

The server rejects raw NTLM. All NTLM tokens are wrapped in ASN.1/DER SPNEGO:

- **Type 1 (Negotiate)**: Wrapped in `NegTokenInit` inside `APPLICATION[0]` with `OID_SPNEGO` + `OID_NTLMSSP`
- **Type 3 (Authenticate)**: Wrapped in `NegTokenResp` with `[2] responseToken`

Functions: `wrapSpnegoInit()`, `wrapSpnegoAuth()`, `extractNtlmToken()`

### NTLMv2 with MIC

When the server's Type 2 TargetInfo contains `MsvAvTimestamp`, a MIC is required:

1. Parse TargetInfo AV_PAIRs from Type 2
2. Inject `MsvAvFlags = 0x02` (MIC_PROVIDED) before `MsvAvEOL`
3. Build Type 3 with 88-byte header (64 base + 8 version + 16 MIC placeholder)
4. Compute MIC: `HMAC_MD5(SessionBaseKey, Type1 || Type2 || Type3_zeroed_MIC)`
5. Write MIC into Type 3 at offset 72

### No KEY_EXCH

`NEGOTIATE_FLAGS` does NOT include `NTLMSSP_NEGOTIATE_KEY_EXCH` (0x40000000).
This means `ExportedSessionKey = SessionBaseKey` — avoids RC4 encryption of the
session key, which OpenSSL 3.x disables.

### LM Response

Zero-length when MIC is present (per MS-NLMP 3.1.5.1.2).

### NTOWFv2 Domain

Uses the server's **NetBIOS domain name** from Type 2 TargetInfo (`MsvAvNbDomainName`),
NOT the domain from config. This is critical — if the domain doesn't match what the
server expects, `NTOWFv2` produces a wrong key and auth fails silently.

---

## Packet Signing

All SMB2 requests after authentication are **HMAC-SHA256 signed**:

1. Set `SMB2_FLAGS_SIGNED` (0x08) in header flags
2. Zero the 16-byte signature field (offset 48-63)
3. Compute `HMAC-SHA256(SigningKey, entire_packet)` — signing key = `SessionBaseKey`
4. Copy first 16 bytes of HMAC into signature field

Without signing: `STATUS_ACCESS_DENIED` on TreeConnect.

---

## DFS Namespace Resolution

The share `dfs` is a Microsoft DFS namespace, not a regular SMB share. Accessing it
requires multi-level referral resolution:

### Level 1: Root Referral (Domain Controller)

```
Client --> DC (Opr.statefarm.org)
  TreeConnect(IPC$)
  IOCTL(FSCTL_DFS_GET_REFERRALS, "\\Opr.statefarm.org\\dfs")
  Response: namespace server (e.g., WPSHVL58)
```

### Level 2: Link Referral (Namespace Server)

```
Client --> Namespace Server (WPSHVL58)
  connectAndAuth()
  TreeConnect(IPC$)
  IOCTL(FSCTL_DFS_GET_REFERRALS, "\\Opr.statefarm.org\\dfs\\CORP\\00\\WORKGROUP\\FTP\\FTP_412")
  Response: file server (e.g., isi291afiz11s) + sub-path within share
```

### Level 3: File Access (File Server)

```
Client --> File Server (isi291afiz11s)
  connectAndAuth()
  TreeConnect(\\isi291afiz11s\\secureftp)
  CREATE + READ + CLOSE
```

### Path Computation

The referral response includes:
- **NetworkAddress**: `\\server\share\sub\path` — may include a sub-path within the share
- **PathConsumed**: How many UTF-16 bytes of the request path the referral resolved

`computeTargetFilePath()` combines:
- `target.subPath` (from network address, e.g., `workgroup\FTP_412`)
- Remaining path after consumed portion
- Unqueried tail (parts not included in the referral request)

### Progressive Path Shortening

DFS referral requests try progressively shorter paths:
```
\Opr.statefarm.org\dfs\CORP\00\WORKGROUP\FTP\FTP_412\file.txt  (full)
\Opr.statefarm.org\dfs\CORP\00\WORKGROUP\FTP\FTP_412           (dir)
\Opr.statefarm.org\dfs\CORP\00\WORKGROUP\FTP                    ...
\Opr.statefarm.org\dfs\CORP\00\WORKGROUP
\Opr.statefarm.org\dfs\CORP\00
\Opr.statefarm.org\dfs\CORP
\Opr.statefarm.org\dfs                                          (root)
```

First successful response is used.

---

## Referral Response Parsing

IOCTL response body layout:
```
Offset  Size  Field
0       2     StructureSize
2       2     Reserved
4       4     CtlCode
8       16    FileId
24      4     InputOffset
28      4     InputCount
32      4     OutputOffset    <-- referral data starts here
36      4     OutputCount
40      4     Flags
44      4     Reserved2
48+     var   Buffer
```

Referral output layout:
```
Offset  Size  Field
0       2     PathConsumed (bytes, UTF-16LE)
2       2     NumberOfReferrals
4       4     ReferralHeaderFlags
8+      var   Referral entries (V1/V3/V4)
```

V3 referral entry (most common):
```
Offset  Size  Field
0       2     VersionNumber (3)
2       2     Size
4       2     ServerType
6       2     ReferralEntryFlags (0x0002 = NameListReferral)
8       4     TimeToLive
12      2     SpecialNameOffset (if NameListReferral)
14      2     NumberOfExpandedNames
16      2     NetworkAddressOffset (if NOT NameListReferral)
18      2     Padding
20+     var   String data (UTF-16LE, null-terminated)
```

---

## OpenSSL 3.x Workarounds

Node.js v24+ ships OpenSSL 3.x which disables legacy algorithms:

| Algorithm | Used For | Workaround |
|-----------|----------|------------|
| MD4 | `NTOWFv2` password hash | `js-md4` (pure JS) |
| DES-ECB | LM hash (unused with MIC) | `des.js` (pure JS) |
| RC4 | Key exchange encryption | Avoided by not setting `KEY_EXCH` flag |

---

## Usage

```typescript
import { readSmbFile } from './integrations/smb.js'

const buffer = await readSmbFile({
  share: '//Opr.statefarm.org/dfs',
  domain: 'OPR',
  username: 'svcaccount',
  password: 'secret',
}, 'CORP/00/WORKGROUP/FTP/FTP_412/data.txt')
```

The wrapper in `smb.ts` handles:
- Parsing `//server/share` or `\\server\share` formats
- Stripping UNC prefix from file paths
- Splitting `DOMAIN\username` into separate fields

---

## Limitations

- **Read-only**: Only `readFile()` is implemented (CREATE with FILE_OPEN + READ)
- **SMB2 only**: Negotiates 0x0202/0x0210 dialects (no SMB3 encryption/multichannel)
- **Single file per connection**: Opens a new TCP connection for each `readFile()` call
- **No connection pooling**: Each call does full Negotiate + SessionSetup + DFS resolution
- **64KB read chunks**: Fixed chunk size (SMB2 max for dialect 0x0202)
- **No directory listing**: Cannot enumerate files in a share
- **No write support**: Cannot create, write, or delete files

---

## References

- [MS-SMB2]: SMB2 Protocol — https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-smb2
- [MS-NLMP]: NT LAN Manager Authentication — https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp
- [MS-SPNG]: SPNEGO — https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-spng
- [MS-DFSC]: DFS Client — https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-dfsc
