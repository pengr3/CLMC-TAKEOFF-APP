import { createReadStream } from 'fs'
import { createHash } from 'crypto'
import { extname } from 'path'
import JSZip from 'jszip'

/**
 * Stream-based SHA256 hash of a file.
 * Uses fs.createReadStream — never loads the entire file into memory (Pitfall 3).
 * Returns a 64-char lowercase hex string.
 */
export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolveP, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolveP(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * SHA256 of an in-memory Buffer or Uint8Array.
 * Use this when the bytes already exist in memory (post-extract or post-embed).
 * For files on disk, prefer sha256File which streams.
 * Returns a 64-char lowercase hex string. Sync — no I/O.
 */
export function sha256Buffer(buf: Buffer | Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex')
}

/**
 * Verify a buffer's SHA256 hash against an expected hex string.
 * Boolean wrapper around `sha256Buffer(buf) === expectedHex`. Case-sensitive
 * (both producers emit lowercase hex from Node's createHash().digest('hex')).
 *
 * Added per cross-AI review feedback to make hash-verification call sites
 * (Wave 2 IPC handler, Wave 4 hook) read as `verifySha256(bytes, expected)`
 * rather than manually composing the equality check.
 */
export function verifySha256(buf: Buffer | Uint8Array, expectedHex: string): boolean {
  return sha256Buffer(buf) === expectedHex
}

/**
 * Ensure the given file path ends with the .clmc extension (case-insensitive).
 * Appends '.clmc' if the current extension is anything else (Pitfall 6).
 */
export function enforceClmcExtension(filePath: string): string {
  return extname(filePath).toLowerCase() === '.clmc' ? filePath : filePath + '.clmc'
}

// ----- v2 ZIP-embedded .clmc format (Phase 4.1) -----

export type ClmcFormat = 'v2-zip' | 'v1-json' | 'unknown'

// ZIP local-file-header signature (PKWARE APPNOTE.txt §4.3.7).
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])

/**
 * Detect file format by sniffing the first 4 bytes.
 * 'PK\x03\x04'  → 'v2-zip'   (ZIP archive)
 * Anything else with length >= 4 → 'v1-json' (caller validates JSON parse)
 * Length < 4 → 'unknown'
 */
export function detectClmcFormat(buf: Buffer): ClmcFormat {
  if (buf.length < 4) return 'unknown'
  if (buf.subarray(0, 4).equals(ZIP_MAGIC)) return 'v2-zip'
  return 'v1-json'
}

export interface ExtractedClmc {
  projectJson: string  // raw text — caller calls JSON.parse + validateV2
  pdfBytes: Buffer     // for IPC return + verifySha256 compare
}

/**
 * Assemble a v2 .clmc archive from project JSON text and embedded PDF bytes.
 * Layout (D-01, D-04):
 *   project.json — UTF-8 JSON, STORE-compressed
 *   plan.pdf     — raw PDF bytes, STORE-compressed (D-03)
 *
 * Returns a Node Buffer ready for fs.writeFile.
 * NEVER call this from the renderer — main process only.
 */
export async function assembleClmcZip(
  projectJson: string,
  pdfBytes: Buffer
): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('project.json', projectJson, { compression: 'STORE' })
  zip.file('plan.pdf', pdfBytes, { compression: 'STORE' })
  return await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'STORE'
  })
}

/**
 * Extract project.json + plan.pdf from a v2 .clmc archive.
 * Throws Error('Invalid .clmc archive: missing project.json') or '... missing plan.pdf'
 * when either expected entry is absent. Other entries (if any) are ignored —
 * exact-match lookup defends against ZIP entry-name traversal (T-4.1-01-01).
 */
export async function extractClmcZip(zipBytes: Buffer): Promise<ExtractedClmc> {
  const zip = await JSZip.loadAsync(zipBytes)
  const jsonEntry = zip.file('project.json')
  const pdfEntry = zip.file('plan.pdf')
  if (!jsonEntry) throw new Error('Invalid .clmc archive: missing project.json')
  if (!pdfEntry) throw new Error('Invalid .clmc archive: missing plan.pdf')
  const [projectJson, pdfBytes] = await Promise.all([
    jsonEntry.async('string'),
    pdfEntry.async('nodebuffer')
  ])
  return { projectJson, pdfBytes }
}
