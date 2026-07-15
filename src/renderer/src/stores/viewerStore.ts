import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { ViewerState, DEFAULT_VIEWPORT, ActiveTool, ViewMode } from '../types/viewer'

// Factory for the viewer store. Kept as a function so the store can be created
// exactly once and then REUSED across Vite hot-reloads (see the import.meta.hot
// block at the bottom of this file). Without HMR preservation, a hot-reload
// re-evaluates this module and calls create() again, producing a second store
// instance: already-mounted components stay subscribed to the OLD instance while
// the global keyboard handler re-imports the NEW one — the classic "state
// changes, UI doesn't" desync that made F3 (snapEnabled/snapSuspended) go dead in
// dev after any HMR update.
//
// Return type is intentionally left to inference: it is the exact Zustand
// `UseBoundStore<Mutate<StoreApi<ViewerState>, subscribeWithSelector>>` shape, and
// `ReturnType<typeof createViewerStore>` (used in the HMR cast below) depends on
// that inference — hand-writing the middleware-augmented type would be brittle.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createViewerStore = () =>
  create<ViewerState>()(
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
      // Phase 16 D-01: center-area workspace toggle. Runtime-only, never serialized
      // to .clmc; resets to 'plan' on setFile/resetViewer/hydrate (below) so a
      // project always opens on the canvas.
      viewMode: 'plan' as ViewMode,
      selectedMarkupIds: [],
      vertexEditMarkupId: null,
      // Phase 14 D-03 snapping flags — runtime-only, never serialized to .clmc
      // (T-14-03-02). snapEnabled defaults ON; snapSuspended is the momentary
      // Alt-held override.
      snapEnabled: true,
      snapSuspended: false,

      setFile: (path, name, totalPages) =>
        set({
          filePath: path,
          fileName: name,
          totalPages,
          currentPage: 1,
          pageViewports: {},
          pageScales: {},
          activeTool: 'select' as ActiveTool,
          viewMode: 'plan' as ViewMode,
          selectedMarkupIds: [],
          vertexEditMarkupId: null
        }),

      setPage: (page) => {
        const { totalPages } = get()
        if (page >= 1 && page <= totalPages) {
          set({ currentPage: page, selectedMarkupIds: [], vertexEditMarkupId: null })
        }
      },

      nextPage: () => {
        const { currentPage, totalPages } = get()
        if (currentPage < totalPages)
          set({ currentPage: currentPage + 1, selectedMarkupIds: [], vertexEditMarkupId: null })
      },

      prevPage: () => {
        const { currentPage } = get()
        if (currentPage > 1)
          set({ currentPage: currentPage - 1, selectedMarkupIds: [], vertexEditMarkupId: null })
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
          activeTool: 'select' as ActiveTool,
          viewMode: 'plan' as ViewMode,
          selectedMarkupIds: [],
          vertexEditMarkupId: null
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

      setViewMode: (mode) => set({ viewMode: mode }),

      setSelectedMarkupIds: (ids) => set({ selectedMarkupIds: ids }),

      clearSelection: () => set({ selectedMarkupIds: [] }),

      setVertexEditMarkupId: (id) => set({ vertexEditMarkupId: id }),

      clearVertexEdit: () => set({ vertexEditMarkupId: null }),

      setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),

      setSnapSuspended: (suspended) => set({ snapSuspended: suspended }),

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
          activeTool: 'select' as ActiveTool,
          viewMode: 'plan' as ViewMode,
          selectedMarkupIds: [],
          vertexEditMarkupId: null
        })
    }))
  )

// Reuse the instance persisted from the previous module version across Vite HMR
// updates so the store is a true singleton. In a production build `import.meta.hot`
// is undefined and this whole block is dead code the bundler strips out. Under
// Vitest it is either undefined (node env) or a stub whose `data` is undefined
// (web/jsdom transform) — both fall through the `?? createViewerStore()` path, so
// tests always get a fresh, normal store. The `?.data?.store` double optional-chain
// is required because the stub exposes a truthy `import.meta.hot` with no `data`.
export const useViewerStore =
  (import.meta.hot?.data?.store as ReturnType<typeof createViewerStore> | undefined) ??
  createViewerStore()

if (import.meta.hot) {
  // Persist THIS instance for the next hot-updated version of the module by
  // MUTATING the persisted `data` object (never reassigning it — Vite forbids
  // that, and its type marks `data` read-only). `data` is always an object in real
  // Vite dev; the Vitest web transform leaves it undefined and never hot-reloads,
  // so the guard simply skips persistence there.
  if (import.meta.hot.data) import.meta.hot.data.store = useViewerStore
  // Make the store a self-accepting HMR boundary so edits here don't bubble up
  // and force importers (or the whole app) to re-evaluate against a fresh store.
  import.meta.hot.accept()
}
