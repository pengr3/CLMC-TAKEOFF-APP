import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile, rename, unlink } from 'fs/promises'
import { extname, basename } from 'path'
import {
  enforceClmcExtension,
  enforceXlsxExtension,
  enforceCsvExtension,
  detectClmcFormat,
  extractClmcZip,
  assembleClmcZip,
  sha256Buffer
} from './project-io'
import { buildBoqXlsx, buildBoqCsv, type BoqStructure } from './boq-writers'

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
 *
 * Windows / OneDrive recovery: rename can fail with EPERM/EEXIST/EBUSY when
 * the destination is held by sync software (OneDrive, Dropbox), antivirus,
 * or another process briefly. On those error codes we retry the rename with a
 * short backoff (transient locks from a sync/AV scan usually clear within a few
 * hundred ms), and — between retries — unlink the destination then retry. The
 * retry path is non-atomic (the original file is briefly absent), but the
 * alternative is a hard failure for every OneDrive user — unacceptable on
 * Windows.
 *
 * PERSISTENT lock (Phase 16 UAT GAP-2): when the destination is held OPEN by
 * another program (classically an .xlsx open in Excel), BOTH the rename and the
 * unlink fail with EPERM through every retry — you cannot overwrite a file
 * another process holds open; that is an OS constraint, not something a retry
 * can defeat. In that case we throw a FRIENDLY, actionable error that names the
 * file and tells the user to close it, instead of leaking the raw
 * `EPERM: … rename '<path>.tmp' -> '<path>'`. The `.tmp` is always cleaned up.
 */
function isLockedDestError(err: unknown): boolean {
  if (err instanceof Error && 'code' in err) {
    const code = (err as NodeJS.ErrnoException).code
    return code === 'EPERM' || code === 'EEXIST' || code === 'EBUSY'
  }
  return false
}

/**
 * Friendly, actionable message for a destination held open by another program.
 * Names the file basename and points at the likely culprit (Excel) so the user
 * knows exactly what to do — supersedes the raw EPERM rename text (GAP-2). Keeps
 * the raw error code appended in parentheses for diagnostics without leading
 * with it.
 */
function lockedDestMessage(finalPath: string, rawCode: string | undefined): string {
  const name = basename(finalPath)
  const codeSuffix = rawCode ? ` (${rawCode})` : ''
  return (
    `Couldn't save "${name}" — it looks like the file is open in another program ` +
    `(for example Excel). Close it and export again.${codeSuffix}`
  )
}

/** Bounded backoff between rename retries (ms). Absorbs transient sync/AV locks. */
const RENAME_RETRY_DELAYS_MS = [120, 250]

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function atomicWriteFile(finalPath: string, data: Buffer): Promise<void> {
  const tmpPath = `${finalPath}.tmp`
  await writeFile(tmpPath, data)

  // Attempt 0 is immediate; each subsequent attempt waits a short backoff first.
  // Up to 3 total rename attempts (1 immediate + RENAME_RETRY_DELAYS_MS.length).
  let lastErr: unknown
  let lastCode: string | undefined
  for (let attempt = 0; attempt <= RENAME_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await delay(RENAME_RETRY_DELAYS_MS[attempt - 1])
    try {
      await rename(tmpPath, finalPath)
      return
    } catch (err) {
      lastErr = err
      lastCode = (err as NodeJS.ErrnoException | undefined)?.code
      if (!isLockedDestError(err)) {
        // Non-lock error (e.g. EACCES on the directory, ENOSPC) — not something a
        // retry helps. Clean up the .tmp and surface the raw error unchanged.
        try { await unlink(tmpPath) } catch { /* ignore */ }
        throw err
      }
      // Locked destination: try to release it before the next rename attempt.
      // ENOENT means it never existed — benign. Any OTHER unlink failure means
      // the file is genuinely held open (Excel etc.); keep looping so the backoff
      // still gives a transient holder a chance to release, but remember we could
      // not unlink.
      try {
        await unlink(finalPath)
      } catch (unlinkErr) {
        const code = (unlinkErr as NodeJS.ErrnoException | undefined)?.code
        if (code !== 'ENOENT') {
          // Cannot remove the lock right now — fall through to the next attempt
          // (or exit the loop after the last attempt) and report the friendly
          // locked-file message below.
          lastCode = lastCode ?? code
        }
      }
    }
  }

  // Every attempt failed on a locked destination. Clean up the .tmp and throw a
  // human, actionable message (GAP-2) instead of the raw EPERM rename text.
  try { await unlink(tmpPath) } catch { /* ignore */ }
  if (isLockedDestError(lastErr)) {
    throw new Error(lockedDestMessage(finalPath, lastCode))
  }
  // Defensive: non-lock errors are handled inside the loop, but never leak undefined.
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
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

  // -------- Phase 5: BOQ Export — D-16 / D-24 --------
  // Save dialog with .xlsx and .csv filters; detects format from chosen extension
  // (Pitfall 7: showSaveDialog does NOT return filterIndex).
  ipcMain.handle(
    'dialog:saveExport',
    async (
      event,
      defaultPath: string,
      format: 'xlsx' | 'csv'
    ): Promise<{ filePath: string; format: 'xlsx' | 'csv' } | null> => {
      const win = BrowserWindow.fromWebContents(event.sender)!
      const xlsxFilter = { name: 'Excel Workbook', extensions: ['xlsx'] }
      const csvFilter = { name: 'CSV', extensions: ['csv'] }
      const filters =
        format === 'csv' ? [csvFilter, xlsxFilter] : [xlsxFilter, csvFilter]
      const result = await dialog.showSaveDialog(win, {
        title: 'Export BOQ',
        defaultPath,
        filters
      })
      if (result.canceled || !result.filePath) return null
      const lowered = result.filePath.toLowerCase()
      if (lowered.endsWith('.csv')) {
        return { filePath: enforceCsvExtension(result.filePath), format: 'csv' }
      }
      return { filePath: enforceXlsxExtension(result.filePath), format: 'xlsx' }
    }
  )

  // Atomic XLSX write: build buffer via ExcelJS, write to .tmp + rename.
  ipcMain.handle(
    'file:writeBoqXlsx',
    async (
      _event,
      filePath: string,
      structure: BoqStructure
    ): Promise<{ ok: true } | { ok: false; reason: string }> => {
      try {
        const buf = await buildBoqXlsx(structure)
        await atomicWriteFile(filePath, buf)
        return { ok: true }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        return { ok: false, reason }
      }
    }
  )

  // Atomic CSV write: build text via csv-stringify, wrap in UTF-8 Buffer, atomic write.
  ipcMain.handle(
    'file:writeBoqCsv',
    async (
      _event,
      filePath: string,
      structure: BoqStructure
    ): Promise<{ ok: true } | { ok: false; reason: string }> => {
      try {
        const csvText = buildBoqCsv(structure)
        await atomicWriteFile(filePath, Buffer.from(csvText, 'utf-8'))
        return { ok: true }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        return { ok: false, reason }
      }
    }
  )

  // NOTE: Removed channels (Wave 2 deletion):
  //   - file:hashPdf       — replaced by sha256Buffer (in extract path) and file:hashBuffer (renderer-driven)
  //   - file:checkExists   — was for missing-PDF recovery (gone in v2)
  //   - file:resolvePdfPath — path resolution removed (D-05)
  //   - file:computeRelativePath — path math removed (D-05)
}
