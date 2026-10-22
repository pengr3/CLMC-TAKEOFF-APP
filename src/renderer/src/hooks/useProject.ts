import { useCallback } from 'react'
import { useViewerStore } from '../stores/viewerStore'
import { useProjectStore } from '../stores/projectStore'
import { useMarkupStore } from '../stores/markupStore'
import { useScaleStore } from '../stores/scaleStore'
import { usePdfDocument } from './usePdfDocument'
import { migrate, type ProjectFile } from '../lib/project-schema'
import { snapshotProject, hydrateStores } from '../lib/project-serialize'
import type { PDFDocumentProxy } from '../lib/pdf-setup'
import { MM_PER_UNIT } from '../types/scale'

let recoveryOperation: Promise<unknown> | null = null
const protectedRevisions = new Map<string, number>()
const restoredSessions = new Set<string>()
const RECOVERY_WARNING = 'Recovery copy could not be updated. Save your project now.'
function recoveryChanged(): void {
  window.dispatchEvent(new Event('clmc:recovery-updated'))
}
export function startRecoverySchedule(capture: () => Promise<boolean>): () => void {
  const timer = window.setInterval(() => {
    void capture().catch(() => {})
  }, 60_000)
  return () => window.clearInterval(timer)
}
function validateRecoveryMetadata(data: ProjectFile): void {
  const finite = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value)
  const point = (value: unknown): boolean =>
    !!value &&
    typeof value === 'object' &&
    finite((value as { x: number }).x) &&
    finite((value as { y: number }).y)
  if (
    !Number.isInteger(data.pdf.totalPages) ||
    data.pdf.totalPages < 1 ||
    data.pages.length !== data.pdf.totalPages ||
    !Object.hasOwn(MM_PER_UNIT, data.globalUnit) ||
    !Number.isInteger(data.currentPage) ||
    data.currentPage < 1 ||
    data.currentPage > data.pdf.totalPages ||
    data.categoryOrder.some((c) => typeof c !== 'string') ||
    Object.values(data.categories).some(
      (c) =>
        !c || typeof c.id !== 'string' || typeof c.name !== 'string' || typeof c.color !== 'string'
    )
  )
    throw new Error('Damaged recovery metadata.')
  for (const [index, p] of data.pages.entries()) {
    if (
      !p ||
      p.pageIndex !== index + 1 ||
      !p.dimensions ||
      !finite(p.dimensions.width) ||
      p.dimensions.width <= 0 ||
      !finite(p.dimensions.height) ||
      p.dimensions.height <= 0 ||
      !p.viewport ||
      !finite(p.viewport.zoom) ||
      p.viewport.zoom <= 0 ||
      !finite(p.viewport.panX) ||
      !finite(p.viewport.panY) ||
      !Array.isArray(p.markups) ||
      (p.scale !== null &&
        (!p.scale ||
          !finite(p.scale.pixelsPerMm) ||
          p.scale.pixelsPerMm <= 0 ||
          !Object.hasOwn(MM_PER_UNIT, p.scale.displayUnit)))
    )
      throw new Error('Damaged recovery metadata.')
    for (const m of p.markups) {
      if (
        !m ||
        typeof m.id !== 'string' ||
        typeof m.name !== 'string' ||
        typeof m.color !== 'string' ||
        typeof m.categoryId !== 'string' ||
        m.page !== p.pageIndex ||
        !['count', 'linear', 'area', 'perimeter', 'wall'].includes(m.type)
      )
        throw new Error('Damaged recovery markup metadata.')
      if (
        m.type === 'count'
          ? !point(m.point)
          : !Array.isArray(m.points) || m.points.some((v) => !point(v))
      )
        throw new Error('Damaged recovery markup geometry.')
      if (m.type === 'wall' && (!finite(m.wallHeight) || m.wallHeight < 0))
        throw new Error('Damaged recovery wall height.')
      if (
        m.type !== 'count' &&
        m.arcs &&
        Object.values(m.arcs).some((a) => !a || !finite(a.midX) || !finite(a.midY))
      )
        throw new Error('Damaged recovery arc geometry.')
    }
  }
}

export function routeOpenByExtension(extension: string): 'pdf' | 'clmc' | 'unknown' {
  const normalized = extension.toLowerCase()
  if (normalized === '.pdf') return 'pdf'
  if (normalized === '.clmc' || normalized === '.bak') return 'clmc'
  return 'unknown'
}

/**
 * Open-flow result. v2 only has these kinds. The v1 missing-pdf/page-count/
 * dimension/hash kinds moved to ReplacePlanPdfResult. 'archive-corrupted'
 * (D-07) is the v2 equivalent of v1's hash-mismatch.
 */
export type ProjectOpenResult =
  | { kind: 'ok' }
  | { kind: 'archive-corrupted'; validated: ProjectFile; pdfBytes: Uint8Array; clmcPath: string }
  | { kind: 'canceled' }
  | { kind: 'error'; message: string; backupPath?: string }

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
    const vp = page.getViewport({ scale: 1, rotation: 0 }) // Pitfall 7
    dims[i] = { width: vp.width, height: vp.height }
  }
  return dims
}

/** Store commit helper has no render closure. PDF actions are passed explicitly. */
async function stageAndCommit(
  data: ProjectFile,
  bytes: Uint8Array,
  stage: (bytes: Uint8Array) => Promise<PDFDocumentProxy>,
  adopt: (doc: PDFDocumentProxy, bytes: Uint8Array, name: string) => void
): Promise<void> {
  const staged = await stage(bytes)
  try {
    if (staged.numPages !== data.pdf.totalPages) throw new Error('Project PDF page count does not match metadata.')
    const dims = await perPageDimensions(staged)
    if (data.pages.some(p => Math.abs(dims[p.pageIndex].width - p.dimensions.width) > 0.5 || Math.abs(dims[p.pageIndex].height - p.dimensions.height) > 0.5))
      throw new Error('Project PDF dimensions do not match metadata.')
    hydrateStores(data)
    adopt(staged, bytes, data.pdf.originalFilename)
  } catch (error) {
    void staged.destroy().catch(() => {})
    throw error
  }
}

function basenameAny(p: string): string {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return idx >= 0 ? p.slice(idx + 1) : p
}

/** Capture before the first await: recovery and explicit saves share this coherent input. */
export interface CapturedProjectSnapshot {
  metadata: ProjectFile
  pdfBytes: Uint8Array
  pdfDocument: PDFDocumentProxy
  documentSessionId: string
  revision: number
  sourcePath: string | null
}
export function captureProjectSnapshot(): CapturedProjectSnapshot {
  const { fileName, totalPages, pdfBytes, pdfDocument } = useViewerStore.getState()
  const project = useProjectStore.getState()
  if (!fileName || !totalPages || !pdfBytes || !pdfDocument)
    throw new Error('No PDF is open to save.')
  const metadata = JSON.parse(
    JSON.stringify(
      snapshotProject({
        pdfOriginalFilename: fileName,
        pdfSha256: '',
        pdfTotalPages: totalPages,
        perPageDimensions: {}
      })
    )
  ) as ProjectFile
  return {
    metadata,
    pdfBytes: pdfBytes.slice(),
    pdfDocument: pdfDocument as PDFDocumentProxy,
    documentSessionId: project.documentSessionId,
    revision: project.editRevision,
    sourcePath: project.currentFilePath
  }
}

export async function finalizeProjectSnapshot(
  captured: CapturedProjectSnapshot,
  createdAt?: string
): Promise<ProjectFile> {
  const pdfSha256 = await window.api.hashBuffer(captured.pdfBytes)
  const dimensions = await perPageDimensions(captured.pdfDocument)
  return snapshotProject(
    {
      pdfOriginalFilename: captured.metadata.pdf.originalFilename,
      pdfSha256,
      pdfTotalPages: captured.metadata.pdf.totalPages,
      perPageDimensions: dimensions,
      createdAt
    },
    captured.metadata
  )
}

interface ProjectActions {
  saveUpgradedCopy: () => Promise<'ok' | 'canceled' | 'error'>
  discardRecovery: () => Promise<boolean>
  writeRecoverySnapshot: () => Promise<boolean>
  restoreRecovery: (id: string) => Promise<ProjectOpenResult>
  newProject: () => void
  saveProject: () => Promise<'ok' | 'canceled' | 'error'>
  saveProjectAs: () => Promise<'ok' | 'canceled' | 'error'>
  retrySaveProject: () => Promise<'ok' | 'canceled' | 'error'>
  openByExtension: (path: string, extension: string) => Promise<ProjectOpenResult>
  openProjectDialog: () => Promise<ProjectOpenResult | null>
  replacePlanPdf: (bytes: Uint8Array, path: string) => Promise<ReplacePlanPdfResult>
  applyReplacePlanPdf: (bytes: Uint8Array, path: string) => Promise<void>
  applyArchiveCorruptedProceed: (
    project: ProjectFile,
    bytes: Uint8Array,
    path: string
  ) => Promise<void>
}
export function useProject(): ProjectActions {
  const { loadPdfFromPath, loadPdfFromBytes, stagePdfFromBytes, adoptStagedPdf } = usePdfDocument()

  const writeRecoverySnapshot = useCallback(async (): Promise<boolean> => {
    const state = useProjectStore.getState()
    if (
      state.isSaving ||
      recoveryOperation ||
      !state.isDirty ||
      !useViewerStore.getState().pdfBytes ||
      document.querySelector('[data-recovery-dialog]')
    )
      return false
    if (protectedRevisions.get(state.documentSessionId) === state.editRevision) return true
    let captured: CapturedProjectSnapshot
    try {
      captured = captureProjectSnapshot()
    } catch {
      useProjectStore.setState({ recoveryWarning: RECOVERY_WARNING })
      return false
    }
    const operation = (async (): Promise<boolean> => {
      try {
        const metadata = await finalizeProjectSnapshot(captured)
        const result = await window.api.writeRecovery({
          session: captured.documentSessionId,
          revision: captured.revision,
          sourcePath: captured.sourcePath,
          lastSavedAt: state.lastSavedAt,
          projectJson: JSON.stringify(metadata),
          pdfBytes: captured.pdfBytes
        })
        if (!result.ok) {
          useProjectStore.setState({ recoveryWarning: RECOVERY_WARNING })
          return false
        }
        protectedRevisions.set(captured.documentSessionId, result.candidate.revision)
        useProjectStore.setState({ recoveryWarning: null })
        recoveryChanged()
        return true
      } catch {
        useProjectStore.setState({ recoveryWarning: RECOVERY_WARNING })
        return false
      }
    })()
    recoveryOperation = operation
    try {
      return await operation
    } finally {
      if (recoveryOperation === operation) recoveryOperation = null
    }
  }, [])

  async function retireCapturedRecovery(session: string, revision: number): Promise<boolean> {
    const protectedRevision = protectedRevisions.get(session)
    if (protectedRevision === undefined || protectedRevision > revision) return true
    try {
      const result = await window.api.retireRecoveryRevision(session, protectedRevision)
      if (!result.ok) return false
      if (protectedRevisions.get(session) === protectedRevision) protectedRevisions.delete(session)
      recoveryChanged()
      return true
    } catch {
      return false
    }
  }
  const discardRecovery = useCallback(async (): Promise<boolean> => {
    const { documentSessionId, editRevision, isSaving } = useProjectStore.getState()
    if (isSaving) return false
    if (recoveryOperation) await recoveryOperation
    const ok = await retireCapturedRecovery(documentSessionId, editRevision)
    if (!ok)
      useProjectStore.setState({
        recoveryWarning: 'Could not delete the recovery copy. It has been kept. Try again later.'
      })
    return ok
  }, [])

  const restoreRecovery = useCallback(
    async (id: string): Promise<ProjectOpenResult> => {
      if (useProjectStore.getState().isSaving || recoveryOperation) return { kind: 'canceled' }
      const operation = (async (): Promise<ProjectOpenResult> => {
        let staged: PDFDocumentProxy | undefined
        try {
          const result = await window.api.readRecovery(id)
          if (!result.ok) return { kind: 'error', message: result.message }
          const raw = JSON.parse(result.projectJson)
          const { data } = migrate(raw, raw.formatVersion)
          validateRecoveryMetadata(data)
          if ((await window.api.hashBuffer(result.pdfBytes)) !== data.pdf.sha256)
            throw new Error(
              'The recovery PDF is missing or damaged. This copy cannot be opened safely.'
            )
          staged = await stagePdfFromBytes(result.pdfBytes)
          if (staged.numPages !== data.pdf.totalPages)
            throw new Error(
              'The recovery PDF is missing or damaged. This copy cannot be opened safely.'
            )
          // All fallible I/O/validation precedes this synchronous store commit.
          hydrateStores(data)
          adoptStagedPdf(staged, result.pdfBytes, data.pdf.originalFilename)
          staged = undefined
          useProjectStore.setState({
            currentFilePath: data.preservedSource?.backup ? null : result.candidate.sourcePath,
            preservedSource: data.preservedSource ?? ((raw.formatVersion < 3 || useProjectStore.getState().geometryReviewPages.length > 0) && result.candidate.sourcePath ? { path: result.candidate.sourcePath, format: raw.formatVersion, backup: false } : null),
            documentSessionId: result.candidate.session,
            editRevision: result.candidate.revision,
            savedRevision: -1,
            isDirty: true,
            lastSavedAt: result.candidate.lastSavedAt
          })
          protectedRevisions.set(result.candidate.session, result.candidate.revision)
          restoredSessions.add(result.candidate.session)
          return { kind: 'ok' }
        } catch (error) {
          return { kind: 'error', message: error instanceof Error ? error.message : String(error) }
        } finally {
          if (staged) void staged.destroy().catch(() => {})
        }
      })()
      recoveryOperation = operation
      try {
        return await operation
      } finally {
        if (recoveryOperation === operation) recoveryOperation = null
      }
    },
    [stagePdfFromBytes, adoptStagedPdf]
  )

  const newProject = useCallback((): void => {
    if (
      useProjectStore.getState().isSaving ||
      useProjectStore.getState().saveFailure ||
      recoveryOperation
    )
      return
    useMarkupStore.getState().reset()
    useScaleStore.getState().reset()
    useViewerStore.getState().resetViewer()
    useProjectStore.getState().reset()
  }, [])

  // ===== SAVE =====

  function requestUpgrade(): boolean {
    const source = useProjectStore.getState().preservedSource
    if (!source || source.backup || source.format >= 3) return false
    useProjectStore.setState({ upgradeRequested: true })
    return true
  }

  const saveProject = useCallback(async (): Promise<'ok' | 'canceled' | 'error'> => {
    if (recoveryOperation) await recoveryOperation
    const { currentFilePath, isSaving } = useProjectStore.getState()
    if (isSaving) return 'canceled' // T-4.1-04-05 race guard
    if (requestUpgrade()) return 'canceled'
    if (!currentFilePath) return saveProjectAsImpl()
    if (restoredSessions.has(useProjectStore.getState().documentSessionId)) {
      // Acquire before the availability IPC so a document switch cannot pair a
      // different document's capture with this restored destination.
      useProjectStore.getState().setSaving(true)
      try {
        let writable = false
        try {
          writable = await window.api.recoveryDestinationWritable(
            useProjectStore.getState().documentSessionId
          )
        } catch {
          /* use native Save As */
        }
        return await (writable ? writeSnapshotToPath(currentFilePath, false) : saveProjectAsImpl())
      } finally {
        useProjectStore.getState().setSaving(false)
      }
    }
    return writeSnapshotToPath(currentFilePath, false)
  }, [])

  const saveProjectAs = useCallback(async (): Promise<'ok' | 'canceled' | 'error'> => {
    if (recoveryOperation) await recoveryOperation
    if (useProjectStore.getState().isSaving) return 'canceled'
    if (requestUpgrade()) return 'canceled'
    return saveProjectAsImpl()
  }, [])

  // This event action is intentionally not memoized: it reads current stores and
  // the current save helper on every invocation, without a stale callback closure.
  const saveUpgradedCopy = async (): Promise<'ok' | 'canceled' | 'error'> => {
    if (recoveryOperation) await recoveryOperation
    if (useProjectStore.getState().isSaving) return 'canceled'
    try { return await saveProjectAsImpl() }
    finally { useProjectStore.setState({ upgradeRequested: false }) }
  }

  const retrySaveProject = useCallback(async (): Promise<'ok' | 'canceled' | 'error'> => {
    if (recoveryOperation) await recoveryOperation
    const { isSaving, saveFailure } = useProjectStore.getState()
    if (isSaving) return 'canceled'
    if (!saveFailure?.path) return saveProjectAsImpl()
    return writeSnapshotToPath(saveFailure.path, saveFailure.firstSave)
  }, [])

  async function saveProjectAsImpl(): Promise<'ok' | 'canceled' | 'error'> {
    useProjectStore.getState().setSaving(true)
    try {
      const { fileName: pdfName, totalPages } = useViewerStore.getState()
      if (totalPages === 0) throw new Error('No PDF is open to save.')
      const dotIdx = (pdfName ?? '').lastIndexOf('.')
      const baseNoExt = dotIdx > 0 ? (pdfName as string).slice(0, dotIdx) : (pdfName ?? 'project')
      const source = useProjectStore.getState().preservedSource
      const suffix = source ? (source.backup ? '-copy' : '-upgraded') : ''
      const defaultPath = `${baseNoExt}${suffix}.clmc`
      const chosen = await window.api.saveProjectDialog(defaultPath)
      if (!chosen) return 'canceled'
      return await writeSnapshotToPath(chosen, true)
    } catch (error) {
      useProjectStore
        .getState()
        .setSaveFailure({
          path: '',
          stage: 'write',
          firstSave: true,
          message: error instanceof Error ? error.message : String(error)
        })
      return 'error'
    } finally {
      useProjectStore.getState().setSaving(false)
    }
  }

  async function writeSnapshotToPath(
    clmcPath: string,
    firstSave: boolean
  ): Promise<'ok' | 'canceled' | 'error'> {
    const setSaving = useProjectStore.getState().setSaving
    setSaving(true)
    try {
      const captured = captureProjectSnapshot()

      // Preserve createdAt for non-first saves.
      let createdAt: string | undefined
      if (!firstSave) {
        try {
          const prev = await window.api.readProject(clmcPath)
          if (prev.kind === 'v2-zip' && prev.projectJson) {
            const prevData = JSON.parse(prev.projectJson) as ProjectFile
            createdAt = prevData.createdAt
          }
        } catch {
          /* file may not exist yet or be readable; ignore */
        }
      }

      const snap = await finalizeProjectSnapshot(captured, createdAt)
      const source = captured.metadata.preservedSource
      const original = source?.backup ? source.path.replace(/\.bak$/i, '') : source?.path
      const preservedPaths = original ? [original, `${original}.bak`] : []
      // Rollback association belongs to an unsaved/recovery snapshot, not the new portable copy.
      snap.preservedSource = null
      const result = preservedPaths.length
        ? await window.api.writeProject(clmcPath, JSON.stringify(snap), captured.pdfBytes, preservedPaths)
        : await window.api.writeProject(clmcPath, JSON.stringify(snap), captured.pdfBytes)
      if (!result.ok) {
        useProjectStore.getState().setSaveFailure({ ...result, path: clmcPath })
        return 'error'
      }
      const retired = await retireCapturedRecovery(captured.documentSessionId, captured.revision)
      restoredSessions.delete(captured.documentSessionId)
      useProjectStore
        .getState()
        .acknowledgeSavedRevision(clmcPath, captured.documentSessionId, captured.revision)
      if (useProjectStore.getState().documentSessionId === captured.documentSessionId)
        useProjectStore.setState({ preservedSource: null, upgradeRequested: false })
      if (!retired)
        useProjectStore.setState({
          recoveryWarning: 'Could not delete the recovery copy. It has been kept. Try again later.'
        })
      else useProjectStore.setState({ recoveryWarning: null })
      return 'ok'
    } catch (err) {
      console.error('[useProject] save failed:', err)
      useProjectStore
        .getState()
        .setSaveFailure({
          path: clmcPath,
          stage: 'write',
          firstSave,
          message: err instanceof Error ? err.message : String(err)
        })
      return 'error'
    } finally {
      setSaving(false) // T-4.1-04-01: ALWAYS reset, even on error
    }
  }

  // ===== OPEN =====

  const openClmcFromPath = useCallback(
    async (clmcPath: string): Promise<ProjectOpenResult> => {
      if (useProjectStore.getState().isSaving || useProjectStore.getState().saveFailure)
        return { kind: 'canceled' }
      try {
        const result = await window.api.readProject(clmcPath)
        if (result.kind === 'unknown') {
          return { kind: 'error', message: `Cannot open .clmc file: ${result.reason ?? 'unknown'}`, backupPath: result.backupPath }
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
    [stagePdfFromBytes, adoptStagedPdf]
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
    const { data: validated, wasMigrated } = migrate(raw, version)

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

    await stageAndCommit(validated, pdfBytes, stagePdfFromBytes, adoptStagedPdf)
    openedAssociation(clmcPath, version, wasMigrated)
    return { kind: 'ok' }
  }

  function openedAssociation(path: string, format: number, migrated: boolean): void {
    const backup = path.toLowerCase().endsWith('.clmc.bak')
    useProjectStore.setState({
      currentFilePath: backup ? null : path,
      preservedSource: format < 3 || backup || useProjectStore.getState().geometryReviewPages.length > 0 ? { path, format, backup } : null,
      isDirty: migrated || backup,
      lastSavedAt: migrated || backup ? null : Date.now(),
      lastSaveOutcome: backup ? { revision: -1, message: 'Backup opened. Use Save As to create a project copy.', at: Date.now() } : null
    })
  }

  /** Legacy JSON alone needs its source PDF. Validate, read and stage before
   * adopting any bytes or resetting stores; a missing source keeps the live project. */
  async function openV1Silent(text: string, clmcPath: string): Promise<ProjectOpenResult> {
    const raw = JSON.parse(text) as unknown
    const { data: validated, wasMigrated } = migrate(raw, 1)

    const v1pdf = (raw as { pdf: { absolutePath: string } }).pdf
    const absPath = v1pdf.absolutePath

    let pdfArrayBuf: ArrayBuffer
    try {
      pdfArrayBuf = await window.api.readPdfBytes(absPath)
    } catch {
      return {
        kind: 'error',
        message: 'The PDF used by this older project is unavailable. Restore it at the original location and open the project again. Your current project has been kept.'
      }
    }
    const pdfBytes = new Uint8Array(pdfArrayBuf)

    if ((await window.api.hashBuffer(pdfBytes)) !== validated.pdf.sha256)
      return { kind: 'archive-corrupted', validated, pdfBytes, clmcPath }

    await stageAndCommit(validated, pdfBytes, stagePdfFromBytes, adoptStagedPdf)
    openedAssociation(clmcPath, 1, wasMigrated)
    return { kind: 'ok' }
  }

  /**
   * D-07: user clicked "Open anyway" on archive-corrupted modal.
   * Bypass the hash check; proceed to load + hydrate.
   */
  const applyArchiveCorruptedProceed = useCallback(
    async (validated: ProjectFile, pdfBytes: Uint8Array, clmcPath: string): Promise<void> => {
      if (
        useProjectStore.getState().isSaving ||
        useProjectStore.getState().saveFailure ||
        recoveryOperation
      )
        return
      await stageAndCommit(validated, pdfBytes, stagePdfFromBytes, adoptStagedPdf)
      openedAssociation(clmcPath, validated.formatVersion, validated.formatVersion < 3)
    },
    [stagePdfFromBytes, adoptStagedPdf]
  )

  // ===== REPLACE PLAN PDF =====

  const replacePlanPdf = useCallback(
    async (newBytes: Uint8Array, pickedPath: string): Promise<ReplacePlanPdfResult> => {
      if (
        useProjectStore.getState().isSaving ||
        useProjectStore.getState().saveFailure ||
        recoveryOperation
      )
        return { kind: 'canceled' }
      try {
        const { totalPages: expectedPages, pdfDocument: currentDoc } = useViewerStore.getState()
        const currentDocProxy = currentDoc as PDFDocumentProxy | null

        // pdfjsLib.getDocument transfers the underlying ArrayBuffer to its worker,
        // leaving the source Uint8Array detached. We must NOT pass `newBytes` directly
        // — both the probe below AND the downstream applyReplacePlanPdf / pendingBytes
        // paths need a live buffer afterwards. Take ONE clone for the probe, and a
        // SECOND clone (also from the still-live `newBytes`) only if we need to hand
        // bytes to a downstream consumer. That keeps `newBytes` itself live for the
        // happy-path call to applyReplacePlanPdf below. See pdf-setup.cloneForPdfWorker
        // for the full hazard explanation. (Closes UAT Test 3 — 04.1-UAT.md)
        const { pdfjsLib, cloneForPdfWorker } = await import('../lib/pdf-setup')
        const tempDoc = (await pdfjsLib.getDocument({
          data: cloneForPdfWorker(newBytes)
        }).promise) as PDFDocumentProxy

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
            // Hand the caller a live, independent copy — `newBytes` is still live here
            // (only the clone was transferred to the worker), but defensively cloning
            // again insulates the Use-anyway flow from any caller that might recycle
            // the original Uint8Array.
            return {
              kind: 'dimension-mismatch',
              pendingBytes: cloneForPdfWorker(newBytes),
              pendingFilename: basenameAny(pickedPath)
            }
          }
        }
        await tempDoc.destroy()

        // All clear — apply (D-10). `newBytes` is still live; loadPdf's own
        // cloneForPdfWorker call will protect its internal getDocument transfer.
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
      if (
        useProjectStore.getState().isSaving ||
        useProjectStore.getState().saveFailure ||
        recoveryOperation
      )
        return
      const filename = basenameAny(pickedPath)
      await loadPdfFromBytes(newBytes, filename)
      // loadPdfFromBytes already updated viewerStore.pdfBytes, pdfDocument, fileName, totalPages.
      useProjectStore.getState().markDirty()
    },
    [loadPdfFromBytes]
  )

  // ===== TOP-LEVEL OPEN ENTRY =====

  const openProjectDialog = useCallback(async (): Promise<ProjectOpenResult | null> => {
    if (recoveryOperation) return { kind: 'canceled' }
    if (useProjectStore.getState().isSaving || useProjectStore.getState().saveFailure)
      return { kind: 'canceled' }
    const picked = await window.api.openProject()
    if (!picked) return { kind: 'canceled' }
    return openByExtension(picked.filePath, picked.extension)
  }, [openClmcFromPath])

  const openByExtension = useCallback(
    async (filePath: string, extension: string): Promise<ProjectOpenResult> => {
      if (recoveryOperation) return { kind: 'canceled' }
      if (useProjectStore.getState().isSaving || useProjectStore.getState().saveFailure)
        return { kind: 'canceled' }
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
        if (extension.toLowerCase() === '.bak' && !filePath.toLowerCase().endsWith('.clmc.bak'))
          return { kind: 'error', message: 'Choose a .clmc.bak project backup.' }
        return openClmcFromPath(filePath)
      }
      return { kind: 'error', message: `Unknown file extension: ${extension}` }
    },
    [openClmcFromPath, newProject, loadPdfFromPath]
  )

  return {
    saveUpgradedCopy,
    discardRecovery,
    writeRecoverySnapshot,
    restoreRecovery,
    newProject,
    saveProject,
    saveProjectAs,
    retrySaveProject,
    openByExtension,
    openProjectDialog,
    replacePlanPdf,
    applyReplacePlanPdf,
    applyArchiveCorruptedProceed
  }
}

