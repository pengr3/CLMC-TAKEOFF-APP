import { fromBufferPromise } from 'yauzl'
import { crc32 } from 'node:zlib'
import type { Readable } from 'node:stream'
import { LIBRARY_IMPORT_MESSAGES, type LibraryImportCode } from '../shared/cost-library'

// Calibrated with the app's blank template and 10,000 six-column populated rows.
// Exact measurements live in 20-06-SUMMARY; these are absolute caps, not ratios.
export const WORKBOOK_LIMITS = Object.freeze({
  compressedBytes: 10 * 1024 * 1024,
  entries: 2048,
  entryBytes: 32 * 1024 * 1024,
  totalBytes: 128 * 1024 * 1024
})
export interface WorkbookLimits {
  compressedBytes: number
  entries: number
  entryBytes: number
  totalBytes: number
}
export class WorkbookAdmissionError extends Error {
  constructor(readonly code: LibraryImportCode) {
    super(LIBRARY_IMPORT_MESSAGES[code])
  }
}
export interface WorkbookUsage {
  entries: number
  declaredBytes: number
  actualBytes: number
  largestEntryBytes: number
}

/** Drain one entry without collecting chunks, including unused media/worksheets.
 * Exported to independently verify actual-byte budgets against real inflate streams.
 */
export async function countWorkbookEntry(
  stream: Readable,
  usage: WorkbookUsage,
  limits: WorkbookLimits
): Promise<{ bytes: number; checksum: number }> {
  let bytes = 0
  let checksum = 0
  try {
    for await (const chunk of stream) {
      bytes += chunk.length
      usage.actualBytes += chunk.length
      if (bytes > limits.entryBytes || usage.actualBytes > limits.totalBytes)
        throw new WorkbookAdmissionError('resource')
      checksum = crc32(chunk, checksum)
    }
    usage.largestEntryBytes = Math.max(usage.largestEntryBytes, bytes)
    return { bytes, checksum }
  } finally {
    stream.destroy()
  }
}

export async function admitWorkbook(
  compressed: Buffer,
  limits: WorkbookLimits = WORKBOOK_LIMITS
): Promise<WorkbookUsage> {
  if (compressed.length > limits.compressedBytes) throw new WorkbookAdmissionError('resource')
  const zip = await fromBufferPromise(compressed, {
    lazyEntries: true,
    validateEntrySizes: true,
    strictFileNames: true
  }).catch(() => {
    throw new WorkbookAdmissionError('parser')
  })
  const usage: WorkbookUsage = {
    entries: 0,
    declaredBytes: 0,
    actualBytes: 0,
    largestEntryBytes: 0
  }
  const names = new Set<string>()
  try {
    if (zip.entryCount > limits.entries) throw new WorkbookAdmissionError('resource')
    for await (const entry of zip.eachEntry()) {
      usage.entries++
      if (usage.entries > limits.entries) throw new WorkbookAdmissionError('resource')
      if (
        (entry.generalPurposeBitFlag & (1 | 64)) !== 0 ||
        ![0, 8].includes(entry.compressionMethod) ||
        !Number.isSafeInteger(entry.uncompressedSize) ||
        entry.uncompressedSize < 0 ||
        !Number.isSafeInteger(entry.compressedSize) ||
        entry.compressedSize < 0 ||
        names.has(entry.fileName)
      )
        throw new WorkbookAdmissionError('parser')
      names.add(entry.fileName)
      usage.declaredBytes += entry.uncompressedSize
      if (entry.uncompressedSize > limits.entryBytes || usage.declaredBytes > limits.totalBytes)
        throw new WorkbookAdmissionError('resource')
      const stream = await zip.openReadStreamPromise(entry)
      const actual = await countWorkbookEntry(stream, usage, limits)
      if (actual.bytes !== entry.uncompressedSize || actual.checksum !== entry.crc32)
        throw new WorkbookAdmissionError('parser')
    }
    if (usage.entries !== zip.entryCount) throw new WorkbookAdmissionError('parser')
    return usage
  } catch (error) {
    if (error instanceof WorkbookAdmissionError) throw error
    throw new WorkbookAdmissionError('parser')
  } finally {
    zip.close()
  }
}
