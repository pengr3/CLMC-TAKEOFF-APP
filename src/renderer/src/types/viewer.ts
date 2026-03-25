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

  setFile: (path: string, name: string, totalPages: number) => void
  setPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  setViewport: (page: number, viewport: ViewportState) => void
  getViewport: (page: number) => ViewportState
  setZoom: (page: number, zoom: number) => void
  setPan: (page: number, panX: number, panY: number) => void
  setPdfDocument: (doc: unknown | null) => void
  resetViewer: () => void
}

export const DEFAULT_VIEWPORT: ViewportState = { zoom: 1, panX: 0, panY: 0 }
