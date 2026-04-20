import { describe, it, expect, beforeEach } from 'vitest'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { DEFAULT_VIEWPORT, isMarkupTool } from '@renderer/types/viewer'

beforeEach(() => {
  useViewerStore.setState({
    filePath: null,
    fileName: null,
    currentPage: 1,
    totalPages: 0,
    pageViewports: {},
    pdfDocument: null
  })
})

describe('viewer store', () => {
  describe('setFile', () => {
    it('sets file path, name, totalPages and resets to page 1', () => {
      useViewerStore.getState().setFile('/test/plan.pdf', 'plan.pdf', 12)
      const state = useViewerStore.getState()
      expect(state.filePath).toBe('/test/plan.pdf')
      expect(state.fileName).toBe('plan.pdf')
      expect(state.totalPages).toBe(12)
      expect(state.currentPage).toBe(1)
    })
  })

  describe('navigation', () => {
    beforeEach(() => {
      useViewerStore.getState().setFile('/test.pdf', 'test.pdf', 5)
    })

    it('nextPage increments currentPage', () => {
      useViewerStore.getState().nextPage()
      expect(useViewerStore.getState().currentPage).toBe(2)
    })

    it('nextPage does not exceed totalPages', () => {
      useViewerStore.getState().setPage(5)
      useViewerStore.getState().nextPage()
      expect(useViewerStore.getState().currentPage).toBe(5)
    })

    it('prevPage decrements currentPage', () => {
      useViewerStore.getState().setPage(3)
      useViewerStore.getState().prevPage()
      expect(useViewerStore.getState().currentPage).toBe(2)
    })

    it('prevPage does not go below 1', () => {
      useViewerStore.getState().prevPage()
      expect(useViewerStore.getState().currentPage).toBe(1)
    })

    it('setPage clamps within bounds', () => {
      useViewerStore.getState().setPage(0)
      expect(useViewerStore.getState().currentPage).toBe(1) // unchanged
      useViewerStore.getState().setPage(99)
      expect(useViewerStore.getState().currentPage).toBe(1) // unchanged
    })
  })

  describe('page counter', () => {
    it('displays correct page N of M values', () => {
      useViewerStore.getState().setFile('/p.pdf', 'p.pdf', 12)
      useViewerStore.getState().setPage(3)
      const s = useViewerStore.getState()
      expect(s.currentPage).toBe(3)
      expect(s.totalPages).toBe(12)
    })
  })

  describe('per-page viewport state', () => {
    beforeEach(() => {
      useViewerStore.getState().setFile('/test.pdf', 'test.pdf', 3)
    })

    it('returns DEFAULT_VIEWPORT for unseen pages', () => {
      const vp = useViewerStore.getState().getViewport(1)
      expect(vp).toEqual(DEFAULT_VIEWPORT)
    })

    it('stores and retrieves per-page viewport', () => {
      useViewerStore.getState().setViewport(2, { zoom: 4, panX: 100, panY: 200 })
      const vp = useViewerStore.getState().getViewport(2)
      expect(vp.zoom).toBe(4)
      expect(vp.panX).toBe(100)
      expect(vp.panY).toBe(200)
    })

    it('setZoom updates only zoom for a page', () => {
      useViewerStore.getState().setViewport(1, { zoom: 1, panX: 50, panY: 60 })
      useViewerStore.getState().setZoom(1, 2)
      const vp = useViewerStore.getState().getViewport(1)
      expect(vp.zoom).toBe(2)
      expect(vp.panX).toBe(50)
    })

    it('setPan updates only pan for a page', () => {
      useViewerStore.getState().setViewport(1, { zoom: 3, panX: 0, panY: 0 })
      useViewerStore.getState().setPan(1, 100, 200)
      const vp = useViewerStore.getState().getViewport(1)
      expect(vp.zoom).toBe(3)
      expect(vp.panX).toBe(100)
      expect(vp.panY).toBe(200)
    })
  })

  describe('resetViewer', () => {
    it('clears all state', () => {
      useViewerStore.getState().setFile('/x.pdf', 'x.pdf', 10)
      useViewerStore.getState().setPage(5)
      useViewerStore.getState().setViewport(5, { zoom: 4, panX: 10, panY: 20 })
      useViewerStore.getState().resetViewer()
      const s = useViewerStore.getState()
      expect(s.filePath).toBeNull()
      expect(s.totalPages).toBe(0)
      expect(s.currentPage).toBe(1)
    })
  })
})

describe('ActiveTool markup extensions', () => {
  beforeEach(() => {
    useViewerStore.getState().resetViewer()
  })
  it('setActiveTool accepts count, linear, area, perimeter', () => {
    const { setActiveTool } = useViewerStore.getState()
    for (const tool of ['count', 'linear', 'area', 'perimeter'] as const) {
      setActiveTool(tool)
      expect(useViewerStore.getState().activeTool).toBe(tool)
    }
  })
  it('isMarkupTool discriminates correctly', () => {
    expect(isMarkupTool('count')).toBe(true)
    expect(isMarkupTool('linear')).toBe(true)
    expect(isMarkupTool('area')).toBe(true)
    expect(isMarkupTool('perimeter')).toBe(true)
    expect(isMarkupTool('select')).toBe(false)
    expect(isMarkupTool('scale')).toBe(false)
  })
})
