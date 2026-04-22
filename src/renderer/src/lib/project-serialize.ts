import type { ProjectFileV1 } from './project-schema'
import { useMarkupStore } from '../stores/markupStore'
import { useScaleStore } from '../stores/scaleStore'
import { useViewerStore } from '../stores/viewerStore'
import type { Markup } from '../types/markup'
import type { PageScale } from '../types/scale'
import type { ViewportState } from '../types/viewer'

export interface SnapshotParams {
  pdfAbsolutePath: string
  pdfRelativePath: string | null
  pdfSha256: string
  pdfTotalPages: number
  perPageDimensions: Record<number, { width: number; height: number }>
  createdAt?: string // optional; defaults to "now" for first save
}

/**
 * Snapshot the current store state into a JSON-serializable ProjectFileV1.
 * Reads from .getState() (one shot per store) — no React hooks.
 * Excludes transient state (D-09): undoStack, redoStack, calibMode, activeTool,
 * pdfDocument.
 */
export function snapshotProject(params: SnapshotParams): ProjectFileV1 {
  const markup = useMarkupStore.getState()
  const scale = useScaleStore.getState()
  const viewer = useViewerStore.getState()

  const now = new Date().toISOString()

  const pages = Array.from({ length: params.pdfTotalPages }, (_, i) => {
    const pageIndex = i + 1
    return {
      pageIndex,
      dimensions: params.perPageDimensions[pageIndex] ?? { width: 0, height: 0 },
      scale: scale.pageScales[pageIndex] ?? null,
      viewport: viewer.pageViewports[pageIndex] ?? { zoom: 1, panX: 0, panY: 0 },
      markups: markup.pageMarkups[pageIndex] ?? []
    }
  })

  return {
    formatVersion: 1,
    createdAt: params.createdAt ?? now,
    updatedAt: now,
    pdf: {
      absolutePath: params.pdfAbsolutePath,
      relativePath: params.pdfRelativePath,
      totalPages: params.pdfTotalPages,
      sha256: params.pdfSha256
    },
    globalUnit: scale.globalUnit,
    categories: markup.categories,
    categoryOrder: markup.categoryOrder,
    currentPage: viewer.currentPage,
    pages
  }
}

/**
 * Hydrate the three Zustand stores from a validated ProjectFileV1.
 * One setState() per store to avoid intermediate re-renders (Pitfall 2).
 * Excludes transient state (D-09): undoStack, redoStack, calibMode, activeTool.
 *
 * Wave 1 implementation uses setState directly. Wave 2 will introduce
 * dedicated hydrate(snapshot) methods on each store and a _hydrating
 * guard to suspend dirty-flag tracking — until then, hydrate() writes
 * still flip dirty (the projectStore + subscription land in Wave 2).
 */
export function hydrateStores(data: ProjectFileV1): void {
  // Rebuild per-page maps from the dense pages array
  const pageMarkups: Record<number, Markup[]> = {}
  const pageScales: Record<number, PageScale> = {}
  const pageViewports: Record<number, ViewportState> = {}

  for (const page of data.pages) {
    pageMarkups[page.pageIndex] = page.markups
    if (page.scale) pageScales[page.pageIndex] = page.scale
    pageViewports[page.pageIndex] = page.viewport
  }

  // markupStore — single setState
  useMarkupStore.setState({
    pageMarkups,
    categories: data.categories,
    categoryOrder: data.categoryOrder,
    undoStack: [],
    redoStack: []
  })

  // scaleStore — single setState
  useScaleStore.setState({
    pageScales,
    globalUnit: data.globalUnit,
    calibMode: 'idle'
  })

  // viewerStore — single setState (do NOT touch filePath/fileName/totalPages here;
  // those are owned by usePdfDocument.loadPdfFromPath which runs after hydrate)
  useViewerStore.setState({
    currentPage: data.currentPage,
    pageViewports,
    activeTool: 'select'
  })
}
