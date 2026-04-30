import { useCallback } from 'react'
import { useViewerStore } from '../stores/viewerStore'
import { useProjectStore } from '../stores/projectStore'
import { useMarkupStore } from '../stores/markupStore'
import { useScaleStore } from '../stores/scaleStore'
import { usePdfDocument } from './usePdfDocument'
import { migrate, type ProjectFileV2 } from '../lib/project-schema'
import { snapshotProject, hydrateStores } from '../lib/project-serialize'
import type { PDFDocumentProxy } from '../lib/pdf-setup'

export function routeOpenByExtension(extension: string): 'pdf' | 'clmc' | 'unknown' {
  const normalized = extension.toLowerCase()
  if (normalized === '.pdf') return 'pdf'
  if (normalized === '.clmc') return 'clmc'
  return 'unknown'
}

/**
 * Open-flow result. v2 only has these kinds. The v1 missing-pdf/page-count/
 * dimension/hash kinds moved to ReplacePlanPdfResult. 'archive-corrupted'
 * (D-07) is the v2 equivalent of v1's hash-mismatch.
 */
export type ProjectOpenResult =
  | { kind: 'ok' }
  | { kind: 'archive-corrupted'; validated: ProjectFileV2; pdfBytes: Uint8Array; clmcPath: string }
  | { kind: 'canceled' }
  | { kind: 'error'; message: string }

export type ReplacePlanPdfResult =
  | { kind: 'ok' }
  | { kind: 'page-count-mismatch'; expected: number; actual: number }
  | { kind: 'dimension-mismatch'; pendingBytes: Uint8Array; pendingFilename: string }
  | { kind: 'canceled' }
  | { kind: 'error'; message: string }

/** Pure helper: maps ProjectOpenResult.kind to the modal that should appear. */
export function routeOpenResult(
  result: ProjectOpenResult | null
): 'none' | 'archive-corrupted' | 'open-error' {
  if (!result || result.kind === 'ok' || result.kind === 'canceled') return 'none'
  if (result.kind === 'archive-corrupted') return 'archive-corrupted'
  if (result.kind === 'error') return 'open-error'
  return 'none'
}

async function perPageDimensions(
  doc: PDFDocumentProxy
): Promise<Record<number, { width: number; height: number }>> {
  const dims: Record<number, { width: number; height: number }> = {}
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const vp = page.getViewport({ scale: 1, rotation: 0 })  // Pitfall 7
    dims[i] = { width: vp.width, height: vp.height }
  }
  return dims
}

function basenameAny(p: string): string {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return idx >= 0 ? p.slice(idx + 1) : p
}

export function useProject() {
  const { loadPdfFromPath, loadPdfFromBytes } = usePdfDocument()

  const newProject = useCallback((): void => {
    useMarkupStore.getState().reset()
    useScaleStore.getState().reset()
    useViewerStore.getState().resetViewer()
    useProjectStore.getState().reset()
  }, [])

  // ===== SAVE =====

  const saveProject = useCallback(async (): Promise<'ok' | 'canceled' | 'error'> => {
    const { currentFilePath, isSaving } = useProjectStore.getState()
    if (isSaving) return 'canceled'   // T-4.1-04-05 race guard
    if (!currentFilePath) return saveProjectAsImpl()
    return writeSnapshotToPath(currentFilePath, false)
  }, [])

  const saveProjectAs = useCallback(async (): Promise<'ok' | 'canceled' | 'error'> => {
    if (useProjectStore.getState().isSaving) return 'canceled'
    return saveProjectAsImpl()
  }, [])

  async function saveProjectAsImpl(): Promise<'ok' | 'canceled' | 'error'> {
    const { fileName: pdfName, totalPages } = useViewerStore.getState()
    if (totalPages === 0) return 'error'
    const dotIdx = (pdfName ?? '').lastIndexOf('.')
    const baseNoExt = dotIdx > 0 ? (pdfName as string).slice(0, dotIdx) : (pdfName ?? 'project')
    const defaultPath = `${baseNoExt}.clmc`
    const chosen = await window.api.saveProjectDialog(defaultPath)
    if (!chosen) return 'canceled'
    return writeSnapshotToPath(chosen, true)
  }

  async function writeSnapshotToPath(
    clmcPath: string,
    firstSave: boolean
  ): Promise<'ok' | 'canceled' | 'error'> {
    const setSaving = useProjectStore.getState().setSaving
    setSaving(true)
    try {
      const { fileName, totalPages, pdfBytes, pdfDocument } = useViewerStore.getState()
      const pdfDoc = pdfDocument as PDFDocumentProxy | null
      if (!pdfDoc || !pdfBytes || totalPages === 0 || !fileName) {
        console.error('[useProject] save: missing PDF state (pdfDoc/pdfBytes/totalPages/fileName)')
        return 'error'
      }

      // Hash via main process (review feedback: no SubtleCrypto in renderer).
      const pdfSha256 = await window.api.hashBuffer(pdfBytes)
      const perPageDims = await perPageDimensions(pdfDoc)

      // Preserve createdAt for non-first saves.
      let createdAt: string | undefined
      if (!firstSave) {
        try {
          const prev = await window.api.readProject(clmcPath)
          if (prev.kind === 'v2-zip' && prev.projectJson) {
            const prevData = JSON.parse(prev.projectJson) as ProjectFileV2
            createdAt = prevData.createdAt
          }
        } catch {
          /* file may not exist yet or be readable; ignore */
        }
      }

      const snap = snapshotProject({
        pdfOriginalFilename: fileName,
        pdfSha256,
        pdfTotalPages: totalPages,
        perPageDimensions: perPageDims,
        createdAt
      })

      await window.api.writeProject(clmcPath, JSON.stringify(snap), pdfBytes)
      useProjectStore.getState().setSaved(clmcPath)
      return 'ok'
    } catch (err) {
      console.error('[useProject] save failed:', err)
      return 'error'
    } finally {
      setSaving(false)  // T-4.1-04-01: ALWAYS reset, even on error
    }
  }

  // ===== OPEN =====

  const openClmcFromPath = useCallback(
    async (clmcPath: string): Promise<ProjectOpenResult> => {
      try {
        const result = await window.api.readProject(clmcPath)
        if (result.kind === 'unknown') {
          return { kind: 'error', message: `Cannot open .clmc file: ${result.reason ?? 'unknown'}` }
        }
        if (result.kind === 'v1-json') {
          return await openV1Silent(result.text!, clmcPath)
        }
        // result.kind === 'v2-zip' — main has pre-hashed pdfBytes
        return await openV2(result.projectJson!, result.pdfBytes!, result.computedSha256!, clmcPath)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[useProject] openClmcFromPath failed:', msg)
        return { kind: 'error', message: msg }
      }
    },
    [loadPdfFromBytes, loadPdfFromPath]
  )

  async function openV2(
    projectJson: string,
    pdfBytes: Uint8Array,
    computedSha256: string,
    clmcPath: string
  ): Promise<ProjectOpenResult> {
    const raw = JSON.parse(projectJson) as unknown
    const version =
      raw && typeof raw === 'object' && 'formatVersion' in (raw as Record<string, unknown>)
        ? (raw as { formatVersion: number }).formatVersion
        : 0
    const { data: validated } = migrate(raw, version)  // wasMigrated=false for v2

    // D-07: compare main-supplied computedSha256 (no renderer-side hashing per review).
    if (computedSha256 !== validated.pdf.sha256) {
      console.warn(
        '[useProject] embedded PDF sha256 mismatch — expected',
        validated.pdf.sha256,
        'got',
        computedSha256
      )
      return { kind: 'archive-corrupted', validated, pdfBytes, clmcPath }
    }

    await loadPdfFromBytes(pdfBytes, validated.pdf.originalFilename)
    hydrateStores(validated)
    useProjectStore.getState().setCurrentFilePath(clmcPath)
    useProjectStore.setState({ isDirty: false, lastSavedAt: Date.now() })
    return { kind: 'ok' }
  }

  /**
   * D-06 silent migration: v1 plain-JSON file. Parse, **read PDF from v1.absolutePath**,
   * call setPdfBytes BEFORE calling migrate (which discards absolutePath), then
   * load PDF, hydrate stores, and mark dirty.
   *
   * **CRITICAL ORDERING (HIGH consensus review concern):**
   *   1. Parse v1 raw JSON
   *   2. Extract v1.pdf.absolutePath (still present in raw)
   *   3. Call window.api.readPdfBytes(absolutePath) — populate Uint8Array
   *   4. Call useViewerStore.setPdfBytes(bytes) — cache for next save
   *   5. Call migrate(raw, 1) — drops absolutePath/relativePath
   *   6. loadPdfFromBytes (renders PDF; also re-caches bytes via the loadPdf path)
   *   7. hydrateStores + setCurrentFilePath + markDirty
   *
   * Without steps 3–4 BEFORE step 5, the next saveProject call would see
   * pdfBytes === null and either crash or produce a corrupt save.
   *
   * If readPdfBytes fails (PDF moved/missing), return kind: 'error' — v1 files
   * were Phase 04 dev-testing artifacts only, no missing-PDF recovery flow in v2.
   */
  async function openV1Silent(text: string, clmcPath: string): Promise<ProjectOpenResult> {
    const raw = JSON.parse(text) as unknown

    // Step 2: Extract absolutePath from raw v1 BEFORE migrate discards it.
    const v1pdf = (raw as { pdf: { absolutePath: string } }).pdf
    const absPath = v1pdf.absolutePath

    // Step 3: Read PDF bytes from v1.pdf.absolutePath.
    let pdfArrayBuf: ArrayBuffer
    try {
      pdfArrayBuf = await window.api.readPdfBytes(absPath)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        kind: 'error',
        message: `v1 .clmc file references a PDF at "${absPath}" which cannot be read (${msg}). v1 .clmc files are dev-only — re-create the project from the PDF to get a v2 archive.`
      }
    }
    const pdfBytes = new Uint8Array(pdfArrayBuf)

    // Step 4: Cache bytes in viewerStore BEFORE migrate (HIGH review concern).
    useViewerStore.getState().setPdfBytes(pdfBytes)

    // Step 5: Migrate (drops absolutePath/relativePath; bytes already cached).
    const { data: validated, wasMigrated } = migrate(raw, 1)

    // Step 6: Load PDF for rendering. loadPdfFromBytes ALSO calls setPdfBytes,
    // which is intentionally redundant — Step 4 above is the load-bearing call
    // for the test, this one is the standard PDF-load housekeeping.
    await loadPdfFromBytes(pdfBytes, validated.pdf.originalFilename)

    // Step 7: hydrate, set current path, mark dirty.
    hydrateStores(validated)
    useProjectStore.getState().setCurrentFilePath(clmcPath)
    if (wasMigrated) {
      useProjectStore.setState({ isDirty: true, lastSavedAt: null })
    }
    return { kind: 'ok' }
  }

  /**
   * D-07: user clicked "Open anyway" on archive-corrupted modal.
   * Bypass the hash check; proceed to load + hydrate.
   */
  const applyArchiveCorruptedProceed = useCallback(
    async (validated: ProjectFileV2, pdfBytes: Uint8Array, clmcPath: string): Promise<void> => {
      await loadPdfFromBytes(pdfBytes, validated.pdf.originalFilename)
      hydrateStores(validated)
      useProjectStore.getState().setCurrentFilePath(clmcPath)
      useProjectStore.setState({ isDirty: false, lastSavedAt: Date.now() })
    },
    [loadPdfFromBytes]
  )

  // ===== REPLACE PLAN PDF =====

  const replacePlanPdf = useCallback(
    async (newBytes: Uint8Array, pickedPath: string): Promise<ReplacePlanPdfResult> => {
      try {
        const { totalPages: expectedPages, pdfDocument: currentDoc } = useViewerStore.getState()
        const currentDocProxy = currentDoc as PDFDocumentProxy | null

        const { pdfjsLib } = await import('../lib/pdf-setup')
        const tempDoc = (await pdfjsLib.getDocument({ data: newBytes }).promise) as PDFDocumentProxy

        // D-09 hard abort: page count mismatch
        if (tempDoc.numPages !== expectedPages) {
          const actual = tempDoc.numPages
          await tempDoc.destroy()
          return { kind: 'page-count-mismatch', expected: expectedPages, actual }
        }

        // D-09 warn-and-allow: dimension mismatch
        if (currentDocProxy) {
          const oldDims = await perPageDimensions(currentDocProxy)
          const newDims = await perPageDimensions(tempDoc)
          const dimMismatch = Object.keys(oldDims).some((k) => {
            const i = Number(k)
            const a = oldDims[i]
            const b = newDims[i]
            if (!a || !b) return false
            return Math.abs(a.width - b.width) > 0.5 || Math.abs(a.height - b.height) > 0.5
          })
          if (dimMismatch) {
            await tempDoc.destroy()
            return {
              kind: 'dimension-mismatch',
              pendingBytes: newBytes,
              pendingFilename: basenameAny(pickedPath)
            }
          }
        }
        await tempDoc.destroy()

        // All clear — apply (D-10)
        await applyReplacePlanPdf(newBytes, pickedPath)
        return { kind: 'ok' }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[useProject] replacePlanPdf failed:', msg)
        return { kind: 'error', message: msg }
      }
    },
    [loadPdfFromBytes]
  )

  const applyReplacePlanPdf = useCallback(
    async (newBytes: Uint8Array, pickedPath: string): Promise<void> => {
      const filename = basenameAny(pickedPath)
      await loadPdfFromBytes(newBytes, filename)
      // loadPdfFromBytes already updated viewerStore.pdfBytes, pdfDocument, fileName, totalPages.
      useProjectStore.getState().markDirty()
    },
    [loadPdfFromBytes]
  )

  // ===== TOP-LEVEL OPEN ENTRY =====

  const openProjectDialog = useCallback(async (): Promise<ProjectOpenResult | null> => {
    const picked = await window.api.openProject()
    if (!picked) return { kind: 'canceled' }
    return openByExtension(picked.filePath, picked.extension)
  }, [openClmcFromPath])

  const openByExtension = useCallback(
    async (filePath: string, extension: string): Promise<ProjectOpenResult> => {
      const route = routeOpenByExtension(extension)
      if (route === 'pdf') {
        try {
          newProject()
          await loadPdfFromPath(filePath)
          return { kind: 'ok' }
        } catch (err) {
          return { kind: 'error', message: err instanceof Error ? err.message : String(err) }
        }
      }
      if (route === 'clmc') {
        return openClmcFromPath(filePath)
      }
      return { kind: 'error', message: `Unknown file extension: ${extension}` }
    },
    [openClmcFromPath, newProject, loadPdfFromPath]
  )

  return {
    newProject,
    saveProject,
    saveProjectAs,
    openByExtension,
    openProjectDialog,
    replacePlanPdf,
    applyReplacePlanPdf,
    applyArchiveCorruptedProceed
  }
}
