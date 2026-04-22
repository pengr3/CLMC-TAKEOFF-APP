import { useCallback } from 'react'
import { useViewerStore } from '../stores/viewerStore'
import { useProjectStore } from '../stores/projectStore'
import { useMarkupStore } from '../stores/markupStore'
import { useScaleStore } from '../stores/scaleStore'
import { usePdfDocument } from './usePdfDocument'
import { migrate, type ProjectFileV1 } from '../lib/project-schema'
import { snapshotProject, hydrateStores } from '../lib/project-serialize'
import type { PDFDocumentProxy } from '../lib/pdf-setup'

export function routeOpenByExtension(extension: string): 'pdf' | 'clmc' | 'unknown' {
  const normalized = extension.toLowerCase()
  if (normalized === '.pdf') return 'pdf'
  if (normalized === '.clmc') return 'clmc'
  return 'unknown'
}

export type ProjectOpenResult =
  | { kind: 'ok' }
  | { kind: 'missing-pdf'; expectedPath: string; expectedName: string; data: ProjectFileV1; clmcPath: string }
  | { kind: 'page-count-mismatch'; expected: number; actual: number; data: ProjectFileV1; clmcPath: string }
  | { kind: 'hash-mismatch'; resolvedPdfPath: string; data: ProjectFileV1; clmcPath: string }
  | { kind: 'dimension-mismatch'; resolvedPdfPath: string; data: ProjectFileV1; clmcPath: string }
  | { kind: 'canceled' }
  | { kind: 'error'; message: string }

async function perPageDimensions(doc: PDFDocumentProxy): Promise<Record<number, { width: number; height: number }>> {
  const dims: Record<number, { width: number; height: number }> = {}
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const vp = page.getViewport({ scale: 1, rotation: 0 })   // Pitfall 7 — rotation-invariant
    dims[i] = { width: vp.width, height: vp.height }
  }
  return dims
}

function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

export function useProject() {
  const { loadPdfFromPath } = usePdfDocument()

  /**
   * New project: reset all stores to initial (Runtime State Inventory).
   * Does NOT touch the PDF — caller may or may not open a PDF afterwards.
   */
  const newProject = useCallback((): void => {
    useMarkupStore.getState().reset()
    useScaleStore.getState().reset()
    useViewerStore.getState().resetViewer()
    useProjectStore.getState().reset()
  }, [])

  /**
   * Save to the existing currentFilePath. If no file path yet, route to Save As.
   */
  const saveProject = useCallback(async (): Promise<'ok' | 'canceled' | 'error'> => {
    const { currentFilePath } = useProjectStore.getState()
    if (!currentFilePath) return saveProjectAsImpl()
    return writeSnapshotToPath(currentFilePath, false)
  }, [])

  const saveProjectAs = useCallback(async (): Promise<'ok' | 'canceled' | 'error'> => {
    return saveProjectAsImpl()
  }, [])

  async function saveProjectAsImpl(): Promise<'ok' | 'canceled' | 'error'> {
    const { filePath: pdfPath, fileName: pdfName, totalPages } = useViewerStore.getState()
    if (!pdfPath || totalPages === 0) return 'error' // D-24 — can't save without an open PDF
    // D-14: default Save As filename = PDF basename with .clmc in the PDF's directory.
    const dotIdx = (pdfName ?? '').lastIndexOf('.')
    const baseNoExt = dotIdx > 0 ? (pdfName as string).slice(0, dotIdx) : (pdfName ?? 'project')
    const pdfDir = pdfPath.replace(/[\\/][^\\/]+$/, '')
    const defaultPath = `${pdfDir}/${baseNoExt}.clmc`
    const chosen = await window.api.saveProjectDialog(defaultPath)
    if (!chosen) return 'canceled'
    return writeSnapshotToPath(chosen, true /* firstSave */)
  }

  /**
   * Write a fresh snapshot to the given .clmc path. Handles createdAt preservation.
   * Path math delegated to main via window.api.computeRelativePath (CONTEXT.md).
   */
  async function writeSnapshotToPath(clmcPath: string, firstSave: boolean): Promise<'ok' | 'canceled' | 'error'> {
    try {
      const { filePath: pdfPath, totalPages } = useViewerStore.getState()
      const pdfDoc = useViewerStore.getState().pdfDocument as PDFDocumentProxy | null
      if (!pdfPath || !pdfDoc || totalPages === 0) return 'error'

      const pdfSha256 = await window.api.hashPdf(pdfPath)
      // Path math runs in main (Node path.win32 semantics). Returns null on cross-drive (Pitfall 4).
      const relativePath = await window.api.computeRelativePath(clmcPath, pdfPath)
      const perPageDims = await perPageDimensions(pdfDoc)

      // Preserve createdAt when overwriting existing file (not first save)
      let createdAt: string | undefined
      if (!firstSave) {
        try {
          const prevText = await window.api.readProject(clmcPath)
          const prev = JSON.parse(prevText) as ProjectFileV1
          createdAt = prev.createdAt
        } catch {
          // file may not exist yet; fall through — snapshotProject will use "now"
        }
      }

      const snap = snapshotProject({
        pdfAbsolutePath: pdfPath,
        pdfRelativePath: relativePath,
        pdfSha256,
        pdfTotalPages: totalPages,
        perPageDimensions: perPageDims,
        createdAt
      })

      await window.api.writeProject(clmcPath, JSON.stringify(snap, null, 2))
      useProjectStore.getState().setSaved(clmcPath)
      return 'ok'
    } catch (err) {
      console.error('[useProject] save failed:', err)
      return 'error'
    }
  }

  /**
   * Main entry for opening a .clmc project. See Research Pattern 2 step order.
   * Returns one of ProjectOpenResult's kinds. Caller (App.tsx) mounts the
   * matching modal for missing-pdf / page-count-mismatch / hash-mismatch /
   * dimension-mismatch; non-terminal kinds are resolved by a follow-up call
   * to relinkPdf() / applyHashMismatchProceed() / applyDimensionMismatchProceed().
   */
  const openClmcFromPath = useCallback(
    async (clmcPath: string): Promise<ProjectOpenResult> => {
      try {
        const text = await window.api.readProject(clmcPath)
        const raw = JSON.parse(text) as unknown
        const version =
          raw && typeof raw === 'object' && 'formatVersion' in (raw as Record<string, unknown>)
            ? (raw as { formatVersion: number }).formatVersion
            : 0
        const data = migrate(raw, version)

        const resolved = await window.api.resolvePdfPath(
          clmcPath,
          data.pdf.absolutePath,
          data.pdf.relativePath
        )
        if (!resolved) {
          return {
            kind: 'missing-pdf',
            expectedPath: data.pdf.absolutePath,
            expectedName: basename(data.pdf.absolutePath),
            data,
            clmcPath
          }
        }

        // Hash compare BEFORE loading bytes fully — hash is its own IPC streaming call.
        const actualHash = await window.api.hashPdf(resolved.resolvedPath)
        if (actualHash !== data.pdf.sha256) {
          // Defer proceed decision to caller — return a result they can resolve.
          return { kind: 'hash-mismatch', resolvedPdfPath: resolved.resolvedPath, data, clmcPath }
        }

        return await finishOpen(resolved.resolvedPath, data, clmcPath)
      } catch (err) {
        console.error('[useProject] openClmc failed:', err)
        return { kind: 'error', message: err instanceof Error ? err.message : String(err) }
      }
    },
    [loadPdfFromPath]
  )

  /**
   * After all pre-checks pass (or user clicks Open Anyway on hash mismatch),
   * load the PDF and hydrate. Returns 'dimension-mismatch' BEFORE hydrate —
   * caller must use applyDimensionMismatchProceed to hydrate post-confirmation.
   */
  async function finishOpen(
    resolvedPdfPath: string,
    data: ProjectFileV1,
    clmcPath: string
  ): Promise<ProjectOpenResult> {
    try {
      const doc = await loadPdfFromPath(resolvedPdfPath)

      if (doc.numPages !== data.pdf.totalPages) {
        return {
          kind: 'page-count-mismatch',
          expected: data.pdf.totalPages,
          actual: doc.numPages,
          data,
          clmcPath
        }
      }

      // Dimension compare (D-27 / Pitfall 7)
      const dims = await perPageDimensions(doc)
      const dimMismatch = data.pages.some((p) => {
        const actual = dims[p.pageIndex]
        if (!actual) return false
        return (
          Math.abs(actual.width - p.dimensions.width) > 0.5 ||
          Math.abs(actual.height - p.dimensions.height) > 0.5
        )
      })
      if (dimMismatch) {
        // Return BEFORE hydrate — user must confirm via applyDimensionMismatchProceed.
        return { kind: 'dimension-mismatch', resolvedPdfPath, data, clmcPath }
      }

      // All clear — hydrate stores and mark clean
      hydrateStores(data)
      useProjectStore.getState().setCurrentFilePath(clmcPath)
      useProjectStore.setState({ isDirty: false, lastSavedAt: Date.now() })
      return { kind: 'ok' }
    } catch (err) {
      return { kind: 'error', message: err instanceof Error ? err.message : String(err) }
    }
  }

  /**
   * Called by App.tsx after user clicks [Open anyway] on hash mismatch.
   * Re-runs finishOpen (which performs the dimension check + hydrate path).
   */
  const applyHashMismatchProceed = useCallback(
    (resolvedPdfPath: string, data: ProjectFileV1, clmcPath: string): Promise<ProjectOpenResult> =>
      finishOpen(resolvedPdfPath, data, clmcPath),
    [loadPdfFromPath]
  )

  /**
   * Called by App.tsx after user clicks [Open anyway] on dimension mismatch.
   * Skips both hash and dimension checks (both already implicitly passed — we
   * only got here because the user explicitly accepted the risk). Hydrates
   * stores, marks clean, writes currentFilePath. Mirrors applyHashMismatchProceed
   * semantics except it does NOT re-run finishOpen (which would re-raise the
   * dimension-mismatch result and loop).
   *
   * Signature ordering (data, resolvedPdfPath, clmcPath) matches the checker's
   * spec. The PDF was loaded in the prior finishOpen call, so pdfDocument is
   * already in viewerStore — we only need to hydrate the other stores.
   */
  const applyDimensionMismatchProceed = useCallback(
    async (data: ProjectFileV1, resolvedPdfPath: string, clmcPath: string): Promise<void> => {
      void resolvedPdfPath // PDF is already loaded in viewerStore from prior finishOpen call
      // Just hydrate + flag clean.
      hydrateStores(data)
      useProjectStore.getState().setCurrentFilePath(clmcPath)
      useProjectStore.setState({ isDirty: false, lastSavedAt: Date.now() })
    },
    []
  )

  /**
   * D-25 Re-link: caller already invoked window.api.openPdf() via Browse button.
   * This function runs the remaining checks (page count, dimensions, hash) and
   * completes the open. D-26 page-count is hard-abort (no proceed option exposed).
   */
  const relinkPdf = useCallback(
    async (newPdfPath: string, data: ProjectFileV1, clmcPath: string): Promise<ProjectOpenResult> => {
      const actualHash = await window.api.hashPdf(newPdfPath)
      const updatedData: ProjectFileV1 = {
        ...data,
        pdf: { ...data.pdf, absolutePath: newPdfPath, relativePath: null, sha256: actualHash }
      }
      // Don't enforce hash match on re-link; caller already chose this file explicitly.
      // Still emit dimension warning if it applies.
      const result = await finishOpen(newPdfPath, updatedData, clmcPath)
      if (result.kind === 'ok') {
        // D-25: re-link updates the pdf reference in memory; dirty MUST be true
        // so user can Ctrl+S to persist the new path.
        useProjectStore.setState({ isDirty: true })
      }
      return result
    },
    [loadPdfFromPath]
  )

  /**
   * Top-level open entry: show file picker, sniff extension, route.
   * Caller is responsible for going through the close-guard first if currentFilePath is dirty (D-21).
   */
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
          // Fresh project: reset stores first so no stale data carries over
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
    relinkPdf,
    applyHashMismatchProceed,
    applyDimensionMismatchProceed
  }
}
