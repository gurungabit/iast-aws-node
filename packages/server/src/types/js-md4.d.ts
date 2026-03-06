declare module 'js-md4' {
  interface Md4 {
    (message: string | ArrayBuffer | Uint8Array): string
    hex(message: string | ArrayBuffer | Uint8Array): string
    arrayBuffer(message: string | ArrayBuffer | Uint8Array | Buffer): ArrayBuffer
    digest(message: string | ArrayBuffer | Uint8Array): number[]
    buffer(message: string | ArrayBuffer | Uint8Array): ArrayBuffer
  }
  const md4: Md4
  export default md4
}
