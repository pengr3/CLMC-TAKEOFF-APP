import { create } from 'zustand'
import { ViewerState, DEFAULT_VIEWPORT } from '../types/viewer'

export const useViewerStore = create<ViewerState>((set, get) => ({
  filePath: null,
  fileName: null,
  currentPage: 1,
  totalPages: 0,
  pageViewports: {},
  pdfDocument: null,

  setFile: (path, name, totalPages) =>
    set({
      filePath: path,
      fileName: name,
      totalPages,
      currentPage: 1,
      pageViewports: {}
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

  resetViewer: () =>
    set({
      filePath: null,
      fileName: null,
      currentPage: 1,
      totalPages: 0,
      pageViewports: {},
      pdfDocument: null
    })
}))
