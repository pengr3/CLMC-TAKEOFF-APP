import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile, rename, unlink } from 'fs/promises'
import { extname, basename } from 'path'
import {
  enforceClmcExtension,
  detectClmcFormat,
  extractClmcZip,
  assembleClmcZip,
  sha256Buffer
} from './project-io'

/**
 * Discriminated union returned by file:readProject.
 *
 * - `v2-zip`: archive opened successfully. `computedSha256` is the SHA256 of the
 *   embedded plan.pdf bytes computed by main — renderer compares this string
 *   against the value in `projectJson.pdf.sha256` rather than re-hashing.
 *   This eliminates the need for SubtleCrypto in the renderer (review feedback).
 * - `v1-json`: legacy plain-JSON file. Renderer must parse + migrate + load PDF
 *   from the v1 absolutePath (Wave 4 silent-migration flow).
 * - `unknown`: empty/truncated/corrupt input. Renderer surfaces as OpenErrorModal.
 */
export type ReadProjectResult =
  | { kind: 'v2-zip'; projectJson: string; pdfBytes: Uint8Array; computedSha256: string }
  | { kind: 'v1-json'; text: string }
  | { kind: 'unknown'; reason: string }

/** Buffer ↔ Uint8Array zero-copy view helpers (see RESEARCH §4). */
function bufToU8(buf: Buffer): Uint8Array {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}
function u8ToBuf(u8: Uint8Array): Buffer {
  return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength)
}

/**
 * Atomic write: write to ${path}.tmp first, then rename to ${path}.
 * On rename failure, unlink the .tmp file so we don't leave orphans on disk.
 * The original ${path} (if any) is untouched until rename succeeds — a power
 * loss / crash mid-write leaves the existing file intact.
 *
 * Per consensus review feedback (MEDIUM concern): protects an estimator's
 * irreplaceable work from partial-write corruption.
 */
async function atomicWriteFile(finalPath: string, data: Buffer): Promise<void> {
  const tmpPath = `${finalPath}.tmp`
  await writeFile(tmpPath, data)
  try {
    await rename(tmpPath, finalPath)
  } catch (err) {
    // Best-effort cleanup; ignore unlink errors (e.g., file already gone).
    try { await unlink(tmpPath) } catch { /* ignore */ }
    throw err
  }
}

export function registerIpcHandlers(): void {
  // -------- PDF picker (unchanged) --------
  ipcMain.handle('dialog:openPdf', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)!
    const result = await dialog.showOpenDialog(win, {
      title: 'Open PDF Floor Plan',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const data = await readFile(filePath)
    return { filePath, data: new Uint8Array(data).buffer }
  })

  // -------- Open project (extension-sniffing) — unchanged --------
  ipcMain.handle('dialog:openProject', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)!
    const result = await dialog.showOpenDialog(win, {
      title: 'Open',
      filters: [
        { name: 'Supported (PDF, CLMC Project)', extensions: ['pdf', 'clmc'] },
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'CLMC Project', extensions: ['clmc'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    return {
      filePath,
      extension: extname(filePath).toLowerCase(),
      fileName: basename(filePath)
    }
  })

  // -------- Save dialog (unchanged) --------
  ipcMain.handle('dialog:saveProject', async (event, defaultPath?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)!
    const result = await dialog.showSaveDialog(win, {
      title: 'Save Project',
      defaultPath,
      filters: [{ name: 'CLMC Project', extensions: ['clmc'] }]
    })
    if (result.canceled || !result.filePath) return null
    return enforceClmcExtension(result.filePath)
  })

  // -------- v2: Read project (auto-detect format; pre-hash embedded PDF) --------
  ipcMain.handle(
    'file:readProject',
    async (_event, filePath: string): Promise<ReadProjectResult> => {
      try {
        const raw = await readFile(filePath)  // Buffer
        const fmt = detectClmcFormat(raw)
        if (fmt === 'v2-zip') {
          const { projectJson, pdfBytes } = await extractClmcZip(raw)
          // Main pre-hashes — renderer never SubtleCrypto's. Review feedback.
          const computedSha256 = sha256Buffer(pdfBytes)
          return {
            kind: 'v2-zip',
            projectJson,
            pdfBytes: bufToU8(pdfBytes),
            computedSha256
          }
        }
        if (fmt === 'v1-json') {
          const text = raw.toString('utf-8')
          return { kind: 'v1-json', text }
        }
        return { kind: 'unknown', reason: 'Empty or truncated .clmc file (less than 4 bytes)' }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { kind: 'unknown', reason: message }
      }
    }
  )

  // -------- v2: Atomic write (.tmp + rename + cleanup) --------
  ipcMain.handle(
    'file:writeProject',
    async (
      _event,
      filePath: string,
      jsonText: string,
      pdfBytes: Uint8Array
    ): Promise<{ ok: true }> => {
      const pdfBuf = u8ToBuf(pdfBytes)
      const zipBuf = await assembleClmcZip(jsonText, pdfBuf)
      await atomicWriteFile(filePath, zipBuf)
      return { ok: true }
    }
  )

  // -------- Hash a Buffer in main; used by renderer save flow before writeProject --------
  // Eliminates SubtleCrypto in renderer (review feedback). Main is single-threaded so
  // this blocks IPC for ~60–170 ms on a 50 MB PDF — same order of magnitude as
  // the SubtleCrypto async path it replaces, with simpler code and no async timing risk.
  ipcMain.handle(
    'file:hashBuffer',
    async (_event, bytes: Uint8Array): Promise<string> => {
      return sha256Buffer(u8ToBuf(bytes))
    }
  )

  // -------- PDF bytes for re-render after open / Replace Plan PDF --------
  // Still needed for v1 silent migration (loads PDF from v1.pdf.absolutePath).
  ipcMain.handle('file:readPdfBytes', async (_event, pdfPath: string): Promise<ArrayBuffer> => {
    const data = await readFile(pdfPath)
    return new Uint8Array(data).buffer
  })

  // NOTE: Removed channels (Wave 2 deletion):
  //   - file:hashPdf       — replaced by sha256Buffer (in extract path) and file:hashBuffer (renderer-driven)
  //   - file:checkExists   — was for missing-PDF recovery (gone in v2)
  //   - file:resolvePdfPath — path resolution removed (D-05)
  //   - file:computeRelativePath — path math removed (D-05)
}
