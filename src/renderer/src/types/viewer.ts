export interface ViewportState {
  zoom: number
  panX: number
  panY: number
}

export interface ViewerState {
  filePath: string | null
  fileName: string | null
  currentPage: number
  totalPages: number
  pageViewports: Record<number, ViewportState>
  pdfDocument: unknown | null
  /**
   * Cached PDF bytes (Phase 4.1).
   *
   * Lifecycle:
   *   - `null` ONLY before any PDF has loaded, or after `resetViewer()`
   *   - non-null `Uint8Array` whenever a project is open (i.e., totalPages > 0)
   *
   * Used by:
   *   - Save flow: avoids re-reading the PDF from disk before assembling the ZIP
   *   - Replace Plan PDF flow: held until user confirms replacement
   *
   * Memory cost: holds one full copy of the PDF bytes in renderer memory while
   * a project is open. For 100 MB+ construction PDFs this is the dominant
   * memory factor — acceptable for a single-user desktop app, flagged in UAT.
   *
   * IMPORTANT: pdfBytes is transient cache and MUST NOT participate in
   * dirty-tracking. Setting pdfBytes does not represent user-edit work.
   */
  pdfBytes: Uint8Array | null
  pageScales: Record<number, ScaleState>
  activeTool: ActiveTool

  /**
   * Plan/Estimate workspace toggle (Phase 16 D-01). 'plan' shows the PDF canvas
   * center area; 'estimate' shows the full-width Estimate sheet. Transient session
   * UI — like `activeTool` and the snapping flags, it is NEVER serialized into the
   * .clmc (snapshotProject reads explicit fields only, so this sibling is auto-
   * excluded) and RESETS to 'plan' on setFile/resetViewer/hydrate so opening a
   * project always lands on the canvas.
   */
  viewMode: ViewMode

  setFile: (path: string, name: string, totalPages: number) => void
  setPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  setViewport: (page: number, viewport: ViewportState) => void
  getViewport: (page: number) => ViewportState
  setZoom: (page: number, zoom: number) => void
  setPan: (page: number, panX: number, panY: number) => void
  setPdfDocument: (doc: unknown | null) => void
  setPdfBytes: (bytes: Uint8Array | null) => void
  resetViewer: () => void

  setPageScale: (page: number, scale: ScaleState) => void
  getPageScale: (page: number) => ScaleState | null
  clearPageScale: (page: number) => void
  setActiveTool: (tool: ActiveTool) => void

  /** Switch the center-area workspace between the Plan canvas and the Estimate sheet (Phase 16 D-01). */
  setViewMode: (mode: ViewMode) => void

  /**
   * IDs of markups currently selected on the active page (Phase 09 D-01).
   * Single-select is `[id]`; multi-select is `[id1, id2, ...]`; nothing
   * selected is `[]`. Page-scoped: cleared automatically on page change,
   * resetViewer(), hydrate(), and setFile().
   */
  selectedMarkupIds: string[]
  setSelectedMarkupIds: (ids: string[]) => void
  clearSelection: () => void

  /**
   * ID of the markup currently in vertex-edit mode (Phase 12 D-04), or null.
   * Drives mount/unmount of the vertex handle overlay layer. Page-scoped:
   * cleared automatically on page change (setPage/nextPage/prevPage),
   * resetViewer(), hydrate(), and setFile() — mirrors selectedMarkupIds.
   */
  vertexEditMarkupId: string | null
  setVertexEditMarkupId: (id: string) => void
  clearVertexEdit: () => void

  /**
   * Snapping master toggle (Phase 14 D-03). ON by default. Flipped persistently
   * by F3. Runtime-only — NOT persisted into the .clmc project file (snapping is
   * a session/workstation preference, not project data — threat T-14-03-02).
   */
  snapEnabled: boolean
  setSnapEnabled: (enabled: boolean) => void

  /**
   * Momentary snap suspend (Phase 14 D-03). Held while Alt is down so a single
   * point can be placed ignoring snapping; released → restored. Runtime-only,
   * never persisted (T-14-03-02).
   */
  snapSuspended: boolean
  setSnapSuspended: (suspended: boolean) => void

  hydrate: (data: { currentPage: number; pageViewports: Record<number, ViewportState> }) => void
}

export const DEFAULT_VIEWPORT: ViewportState = { zoom: 1, panX: 0, panY: 0 }

export type MeasurementUnit = 'm' | 'ft' | 'mm' | 'cm' | 'in'

export interface ScaleState {
  pixelsPerUnit: number
  unit: MeasurementUnit
  realWorldDistance: number
  linePoints: [number, number, number, number] // [x1,y1,x2,y2] in page-space
}

export type ActiveTool = 'select' | 'scale' | 'verify-scale' | 'count' | 'linear' | 'area' | 'perimeter' | 'wall'

/**
 * Center-area workspace mode (Phase 16 D-01). 'plan' → PDF canvas; 'estimate' →
 * full-width Estimate sheet. Transient session UI (never serialized to .clmc).
 */
export type ViewMode = 'plan' | 'estimate'

export const MARKUP_TOOLS = ['count', 'linear', 'area', 'perimeter', 'wall'] as const
export type MarkupToolType = typeof MARKUP_TOOLS[number]

export function isMarkupTool(tool: ActiveTool): tool is MarkupToolType {
  return (MARKUP_TOOLS as readonly string[]).includes(tool)
}

export interface CalibrationPoint {
  x: number
  y: number
}
