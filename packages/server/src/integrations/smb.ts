// SMB network storage for BI Renew AST
// TODO: Implement when BI Renew AST is fully ported

export interface SmbConfig {
  share: string
  domain: string
  username: string
  password: string
}

export async function readSmbFile(_config: SmbConfig, _path: string): Promise<Buffer> {
  // TODO: Use @seald-io/nedb or smbclient
  throw new Error('SMB integration not yet implemented')
}

export async function writeSmbFile(_config: SmbConfig, _path: string, _data: Buffer): Promise<void> {
  throw new Error('SMB integration not yet implemented')
}
