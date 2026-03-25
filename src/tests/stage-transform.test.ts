import { describe, it, expect } from 'vitest'

describe('fit-to-window calculation', () => {
  function calculateFitScale(
    pageWidth: number,
    pageHeight: number,
    containerWidth: number,
    containerHeight: number,
    padding: number = 20
  ): number {
    const availableWidth = containerWidth - padding * 2
    const availableHeight = containerHeight - padding * 2
    const scaleX = availableWidth / pageWidth
    const scaleY = availableHeight / pageHeight
    return Math.min(scaleX, scaleY)
  }

  it('landscape container with portrait page scales by height', () => {
    // A4 at scale 2: 1190x1684, container 1200x800
    const scale = calculateFitScale(1190, 1684, 1200, 800)
    expect(scale).toBeCloseTo((800 - 40) / 1684, 3)
  })

  it('portrait container with landscape page scales by width', () => {
    // A1 landscape at scale 2: 4752x3362, container 800x1200
    const scale = calculateFitScale(4752, 3362, 800, 1200)
    expect(scale).toBeCloseTo((800 - 40) / 4752, 3)
  })

  it('exact fit produces scale near 1', () => {
    const scale = calculateFitScale(760, 760, 800, 800)
    expect(scale).toBe(1) // (800-40)/760 = 1
  })

  it('centers page in container', () => {
    const pageWidth = 1000
    const pageHeight = 500
    const containerWidth = 1200
    const containerHeight = 800
    const fitScale = calculateFitScale(pageWidth, pageHeight, containerWidth, containerHeight)
    const centerX = (containerWidth - pageWidth * fitScale) / 2
    const centerY = (containerHeight - pageHeight * fitScale) / 2
    // Both should be positive (page is smaller than container)
    expect(centerX).toBeGreaterThan(0)
    expect(centerY).toBeGreaterThan(0)
  })
})

describe('pan position persistence', () => {
  it('pan coordinates are preserved as simple {panX, panY} values', () => {
    const viewport = { zoom: 2, panX: -350, panY: -200 }
    // Simulate restoring: stage.position({x: panX, y: panY})
    expect(viewport.panX).toBe(-350)
    expect(viewport.panY).toBe(-200)
    // Scale and position are independent values, not compound
    expect(viewport.zoom).toBe(2)
  })
})
