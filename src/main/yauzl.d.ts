// Narrow declarations for the exact reviewed yauzl 3.4 lazy streaming API.
declare module 'yauzl' {
  import type { Readable } from 'node:stream'
  export interface Entry {
    fileName: string
    compressedSize: number
    uncompressedSize: number
    compressionMethod: number
    generalPurposeBitFlag: number
    crc32: number
  }
  export interface ZipFile {
    entryCount: number
    eachEntry(): AsyncIterable<Entry>
    openReadStreamPromise(entry: Entry): Promise<Readable>
    close(): void
  }
  export function fromBufferPromise(
    buffer: Buffer,
    options: {
      lazyEntries: boolean
      validateEntrySizes: boolean
      strictFileNames: boolean
    }
  ): Promise<ZipFile>
}
