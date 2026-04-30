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

export type ActiveTool = 'select' | 'scale' | 'verify-scale' | 'count' | 'linear' | 'area' | 'perimeter'

export const MARKUP_TOOLS = ['count', 'linear', 'area', 'perimeter'] as const
export type MarkupToolType = typeof MARKUP_TOOLS[number]

export function isMarkupTool(tool: ActiveTool): tool is MarkupToolType {
  return (MARKUP_TOOLS as readonly string[]).includes(tool)
}

export interface CalibrationPoint {
  x: number
  y: number
}
