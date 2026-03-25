import { describe, it, expect } from 'vitest'
import { ZOOM_STEPS } from '@renderer/lib/constants'

// Inline the getNextZoomStep logic for testing (pure function)
function getNextZoomStep(currentZoom: number, direction: 1 | -1): number {
  if (direction === 1) {
    for (const step of ZOOM_STEPS) {
      if (step > currentZoom + 0.001) return step
    }
    return ZOOM_STEPS[ZOOM_STEPS.length - 1]
  } else {
    for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
      if (ZOOM_STEPS[i] < currentZoom - 0.001) return ZOOM_STEPS[i]
    }
    return ZOOM_STEPS[0]
  }
}

// Inline the zoomToPoint math for testing
function zoomToPoint(
  oldScale: number,
  newScale: number,
  pointerX: number,
  pointerY: number,
  stageX: number,
  stageY: number
): { x: number; y: number } {
  const mousePointTo = {
    x: (pointerX - stageX) / oldScale,
    y: (pointerY - stageY) / oldScale
  }
  return {
    x: pointerX - mousePointTo.x * newScale,
    y: pointerY - mousePointTo.y * newScale
  }
}

describe('zoom-to-cursor math', () => {
  it('keeps cursor point fixed after zoom in', () => {
    const pointerX = 400
    const pointerY = 300
    const oldScale = 1
    const newScale = 2
    const stageX = 0
    const stageY = 0

    // Point in stage coords under cursor before zoom
    const stagePointBefore = {
      x: (pointerX - stageX) / oldScale,
      y: (pointerY - stageY) / oldScale
    }

    const newPos = zoomToPoint(oldScale, newScale, pointerX, pointerY, stageX, stageY)

    // Point in stage coords under cursor after zoom
    const stagePointAfter = {
      x: (pointerX - newPos.x) / newScale,
      y: (pointerY - newPos.y) / newScale
    }

    // The stage-space point under the cursor must be the same
    expect(stagePointAfter.x).toBeCloseTo(stagePointBefore.x, 5)
    expect(stagePointAfter.y).toBeCloseTo(stagePointBefore.y, 5)
  })

  it('keeps cursor point fixed after zoom out', () => {
    const pointerX = 600
    const pointerY = 400
    const oldScale = 4
    const newScale = 2
    const stageX = -500
    const stageY = -300

    const stagePointBefore = {
      x: (pointerX - stageX) / oldScale,
      y: (pointerY - stageY) / oldScale
    }

    const newPos = zoomToPoint(oldScale, newScale, pointerX, pointerY, stageX, stageY)

    const stagePointAfter = {
      x: (pointerX - newPos.x) / newScale,
      y: (pointerY - newPos.y) / newScale
    }

    expect(stagePointAfter.x).toBeCloseTo(stagePointBefore.x, 5)
    expect(stagePointAfter.y).toBeCloseTo(stagePointBefore.y, 5)
  })
})

describe('zoom step selection', () => {
  it('zooms in to next step from 1', () => {
    expect(getNextZoomStep(1, 1)).toBe(1.25)
  })

  it('zooms out to previous step from 1', () => {
    expect(getNextZoomStep(1, -1)).toBe(0.75)
  })

  it('does not exceed MAX_ZOOM (8)', () => {
    expect(getNextZoomStep(8, 1)).toBe(8)
  })

  it('does not go below MIN_ZOOM (0.25)', () => {
    expect(getNextZoomStep(0.25, -1)).toBe(0.25)
  })

  it('snaps to nearest step when between steps', () => {
    // Current zoom is 1.1 (between 1 and 1.25)
    expect(getNextZoomStep(1.1, 1)).toBe(1.25)
    expect(getNextZoomStep(1.1, -1)).toBe(1)
  })

  it('covers all 10 zoom steps', () => {
    expect(ZOOM_STEPS).toEqual([0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 8])
  })
})
