import type { ProjectFileV1 } from './project-schema'
import { useMarkupStore } from '../stores/markupStore'
import { useScaleStore } from '../stores/scaleStore'
import { useViewerStore } from '../stores/viewerStore'
import {
  useProjectStore,
  suspendDirtyTracking,
  resumeDirtyTracking
} from '../stores/projectStore'
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
 * Brackets all store writes with suspendDirtyTracking()/resumeDirtyTracking()
 * so opening a .clmc file does NOT leave isDirty=true (Pitfall 1).
 * Each store's dedicated hydrate() method uses ONE setState call per store (Pitfall 2).
 * Calls reset() before hydrate() to guarantee a clean slate when opening
 * a second project in the same session (Runtime State Inventory).
 * Excludes transient state (D-09): undoStack, redoStack, calibMode, activeTool.
 */
export function hydrateStores(data: ProjectFileV1): void {
  suspendDirtyTracking()
  try {
    // Rebuild per-page maps from the dense pages array
    const pageMarkups: Record<number, Markup[]> = {}
    const pageScales: Record<number, PageScale> = {}
    const pageViewports: Record<number, ViewportState> = {}

    for (const page of data.pages) {
      pageMarkups[page.pageIndex] = page.markups
      if (page.scale) pageScales[page.pageIndex] = page.scale
      pageViewports[page.pageIndex] = page.viewport
    }

    // Clean slate first (Runtime State Inventory — opening a 2nd project in same session).
    useMarkupStore.getState().reset()
    useScaleStore.getState().reset()
    // viewerStore keeps its existing resetViewer for filePath/fileName etc;
    // we don't call it here because loadPdfFromPath will set those fields.

    // Each hydrate() is ONE setState call per store.
    useMarkupStore.getState().hydrate({
      pageMarkups,
      categories: data.categories,
      categoryOrder: data.categoryOrder
    })

    useScaleStore.getState().hydrate({
      pageScales,
      globalUnit: data.globalUnit
    })

    // viewerStore — do NOT touch filePath/fileName/totalPages here;
    // those are owned by usePdfDocument.loadPdfFromPath which runs after hydrate.
    useViewerStore.getState().hydrate({
      currentPage: data.currentPage,
      pageViewports
    })
  } finally {
    resumeDirtyTracking()
    // Final safety reset — even if a subscription fired in the wrong order during
    // the brief window between reset() and hydrate(), mark clean here.
    useProjectStore.setState({ isDirty: false })
  }
}
