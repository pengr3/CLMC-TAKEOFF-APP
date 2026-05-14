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

    /**
     * Hydrate viewer state from a loaded project.
     *
     * IMPORTANT: `data.pageViewports` is intentionally DROPPED here.
     *
     * Rationale (see .planning/debug/resolved/pdf-not-fitting-on-open.md):
     * Saved viewports are absolute pixel transforms (zoom, panX, panY) computed
     * against the canvas dimensions at save time. Restoring them verbatim on a
     * different-sized monitor leaves the PDF too small (or clipped). By starting
     * with an empty `pageViewports` map, `CanvasViewport`'s auto-fit guard
     * (`vp.zoom === 1 && vp.panX === 0 && vp.panY === 0`) fires for every page on
     * first display, refitting the PDF to the current canvas.
     *
     * The .clmc file still carries a `viewport` field per page (write-only) for
     * forward compatibility; we just ignore it on load.
     */
    hydrate: (data) =>
      set({
        currentPage: data.currentPage,
        pageViewports: {},
        activeTool: 'select' as ActiveTool
      })
  }))
)
