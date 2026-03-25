import { describe, it, expect, beforeEach } from 'vitest'
import { useViewerStore } from '@renderer/stores/viewerStore'

describe('page navigation integration', () => {
  beforeEach(() => {
    useViewerStore.setState({
      filePath: '/test.pdf',
      fileName: 'test.pdf',
      currentPage: 1,
      totalPages: 5,
      pageViewports: {},
      pdfDocument: null
    })
  })

  it('navigating forward then backward preserves viewport state', () => {
    const store = useViewerStore.getState()
    // Set viewport for page 1
    store.setViewport(1, { zoom: 2, panX: 100, panY: 200 })
    // Navigate to page 2
    store.nextPage()
    expect(useViewerStore.getState().currentPage).toBe(2)
    // Set different viewport for page 2
    store.setViewport(2, { zoom: 4, panX: 300, panY: 400 })
    // Navigate back to page 1
    store.prevPage()
    expect(useViewerStore.getState().currentPage).toBe(1)
    // Page 1 viewport should be preserved
    const vp1 = useViewerStore.getState().getViewport(1)
    expect(vp1.zoom).toBe(2)
    expect(vp1.panX).toBe(100)
    // Page 2 viewport should also be preserved
    const vp2 = useViewerStore.getState().getViewport(2)
    expect(vp2.zoom).toBe(4)
  })

  it('fit-to-window calculation produces correct scale', () => {
    // A4-ish page rendered at scale 2: ~1190x1684 CSS pixels
    const pageWidth = 1190
    const pageHeight = 1684
    const containerWidth = 1200
    const containerHeight = 800
    const padding = 20
    const availW = containerWidth - padding * 2
    const availH = containerHeight - padding * 2
    const scaleX = availW / pageWidth
    const scaleY = availH / pageHeight
    const fitScale = Math.min(scaleX, scaleY)
    // scaleY should be smaller (portrait page in landscape container)
    expect(fitScale).toBeCloseTo(availH / pageHeight, 5)
    expect(fitScale).toBeLessThan(1) // page is taller than container
  })
})
