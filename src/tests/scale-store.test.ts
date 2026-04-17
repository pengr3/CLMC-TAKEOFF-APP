import { describe, it, expect, beforeEach } from 'vitest'
import { useViewerStore } from '@renderer/stores/viewerStore'
import type { ScaleState } from '@renderer/types/viewer'

const sampleScale = (overrides: Partial<ScaleState> = {}): ScaleState => ({
  pixelsPerUnit: 100,
  unit: 'm',
  realWorldDistance: 5,
  linePoints: [0, 0, 500, 0],
  ...overrides
})

beforeEach(() => {
  useViewerStore.setState({
    filePath: null,
    fileName: null,
    currentPage: 1,
    totalPages: 0,
    pageViewports: {},
    pdfDocument: null,
    pageScales: {},
    activeTool: 'select'
  })
})

describe('viewer store — per-page scale', () => {
  describe('getPageScale', () => {
    it('returns null when no scale is set for the page', () => {
      expect(useViewerStore.getState().getPageScale(1)).toBeNull()
    })

    it('returns null (not undefined) for missing pages', () => {
      const result = useViewerStore.getState().getPageScale(99)
      expect(result).toBeNull()
      expect(result).not.toBeUndefined()
    })
  })

  describe('setPageScale', () => {
    it('stores a scale state and retrieves it via getPageScale', () => {
      const s = sampleScale()
      useViewerStore.getState().setPageScale(1, s)
      expect(useViewerStore.getState().getPageScale(1)).toEqual(s)
    })

    it('overwrites an existing scale on the same page', () => {
      useViewerStore.getState().setPageScale(1, sampleScale({ pixelsPerUnit: 50 }))
      useViewerStore.getState().setPageScale(1, sampleScale({ pixelsPerUnit: 200 }))
      expect(useViewerStore.getState().getPageScale(1)?.pixelsPerUnit).toBe(200)
    })
  })

  describe('per-page scale independence', () => {
    it('storing scale on page 2 does not affect page 1', () => {
      const s1 = sampleScale({ pixelsPerUnit: 100, unit: 'm' })
      const s2 = sampleScale({ pixelsPerUnit: 250, unit: 'ft' })

      useViewerStore.getState().setPageScale(1, s1)
      useViewerStore.getState().setPageScale(2, s2)

      expect(useViewerStore.getState().getPageScale(1)).toEqual(s1)
      expect(useViewerStore.getState().getPageScale(2)).toEqual(s2)
    })

    it('clearing page 1 does not affect page 2', () => {
      useViewerStore.getState().setPageScale(1, sampleScale())
      useViewerStore.getState().setPageScale(2, sampleScale({ pixelsPerUnit: 999 }))
      useViewerStore.getState().clearPageScale(1)
      expect(useViewerStore.getState().getPageScale(1)).toBeNull()
      expect(useViewerStore.getState().getPageScale(2)?.pixelsPerUnit).toBe(999)
    })
  })

  describe('clearPageScale', () => {
    it('clears the scale for a page', () => {
      useViewerStore.getState().setPageScale(1, sampleScale())
      useViewerStore.getState().clearPageScale(1)
      expect(useViewerStore.getState().getPageScale(1)).toBeNull()
    })

    it('does not throw when clearing a non-existent page', () => {
      expect(() => useViewerStore.getState().clearPageScale(42)).not.toThrow()
    })
  })

  describe('activeTool', () => {
    it('defaults to select', () => {
      expect(useViewerStore.getState().activeTool).toBe('select')
    })

    it('setActiveTool transitions to scale', () => {
      useViewerStore.getState().setActiveTool('scale')
      expect(useViewerStore.getState().activeTool).toBe('scale')
    })

    it('setActiveTool transitions to verify-scale', () => {
      useViewerStore.getState().setActiveTool('verify-scale')
      expect(useViewerStore.getState().activeTool).toBe('verify-scale')
    })

    it('setActiveTool transitions back to select', () => {
      useViewerStore.getState().setActiveTool('scale')
      useViewerStore.getState().setActiveTool('select')
      expect(useViewerStore.getState().activeTool).toBe('select')
    })
  })

  describe('resetViewer clears scale state', () => {
    it('resets pageScales to {} and activeTool to select', () => {
      useViewerStore.getState().setPageScale(1, sampleScale())
      useViewerStore.getState().setPageScale(3, sampleScale())
      useViewerStore.getState().setActiveTool('scale')

      useViewerStore.getState().resetViewer()

      expect(useViewerStore.getState().getPageScale(1)).toBeNull()
      expect(useViewerStore.getState().getPageScale(3)).toBeNull()
      expect(useViewerStore.getState().activeTool).toBe('select')
    })
  })

  describe('setFile clears scale state', () => {
    it('resets pageScales and activeTool when a new file is loaded', () => {
      useViewerStore.getState().setPageScale(1, sampleScale())
      useViewerStore.getState().setActiveTool('scale')

      useViewerStore.getState().setFile('/new/file.pdf', 'file.pdf', 5)

      expect(useViewerStore.getState().getPageScale(1)).toBeNull()
      expect(useViewerStore.getState().activeTool).toBe('select')
    })
  })
})
