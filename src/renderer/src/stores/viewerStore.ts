import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { ViewerState, DEFAULT_VIEWPORT, ActiveTool } from '../types/viewer'

export const useViewerStore = create<ViewerState>()(
  subscribeWithSelector((set, get) => ({
  filePath: null,
  fileName: null,
  currentPage: 1,
  totalPages: 0,
  pageViewports: {},
  pdfDocument: null,
  pdfBytes: null,
  pageScales: {},
  activeTool: 'select' as ActiveTool,

  setFile: (path, name, totalPages) =>
    set({
      filePath: path,
      fileName: name,
      totalPages,
      currentPage: 1,
      pageViewports: {},
      pageScales: {},
      activeTool: 'select' as ActiveTool
    }),

  setPage: (page) => {
    const { totalPages } = get()
    if (page >= 1 && page <= totalPages) {
      set({ currentPage: page })
    }
  },

  nextPage: () => {
    const { currentPage, totalPages } = get()
    if (currentPage < totalPages) set({ currentPage: currentPage + 1 })
  },

  prevPage: () => {
    const { currentPage } = get()
    if (currentPage > 1) set({ currentPage: currentPage - 1 })
  },

  setViewport: (page, viewport) =>
    set((state) => ({
      pageViewports: { ...state.pageViewports, [page]: viewport }
    })),

  getViewport: (page) => get().pageViewports[page] ?? DEFAULT_VIEWPORT,

  setZoom: (page, zoom) => {
    const current = get().getViewport(page)
    get().setViewport(page, { ...current, zoom })
  },

  setPan: (page, panX, panY) => {
    const current = get().getViewport(page)
    get().setViewport(page, { ...current, panX, panY })
  },

  setPdfDocument: (doc) => set({ pdfDocument: doc }),

  setPdfBytes: (bytes) => set({ pdfBytes: bytes }),

  resetViewer: () =>
    set({
      filePath: null,
      fileName: null,
      currentPage: 1,
      totalPages: 0,
      pageViewports: {},
      pdfDocument: null,
      pdfBytes: null,
      pageScales: {},
      activeTool: 'select' as ActiveTool
    }),

  setPageScale: (page, scale) =>
    set((state) => ({
      pageScales: { ...state.pageScales, [page]: scale }
    })),

  getPageScale: (page) => get().pageScales[page] ?? null,

  clearPageScale: (page) =>
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [page]: _removed, ...rest } = state.pageScales
      return { pageScales: rest }
    }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  hydrate: (data) =>
    set({
      currentPage: data.currentPage,
      pageViewports: data.pageViewports,
      activeTool: 'select' as ActiveTool
    })
}))
)
