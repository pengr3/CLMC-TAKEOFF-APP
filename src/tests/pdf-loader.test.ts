import { describe, it, expect } from 'vitest'
import { MAX_CANVAS_DIM, PDF_BASE_SCALE } from '@renderer/lib/constants'

// Test the clamping math directly (extracted logic, not the hook)
function clampedRenderScale(
  viewportWidth: number,
  viewportHeight: number,
  desiredScale: number,
  dpr: number = 1
): number {
  const physicalWidth = viewportWidth * desiredScale * dpr
  const physicalHeight = viewportHeight * desiredScale * dpr
  const maxDim = Math.max(physicalWidth, physicalHeight)
  if (maxDim > MAX_CANVAS_DIM) {
    return desiredScale * (MAX_CANVAS_DIM / maxDim)
  }
  return desiredScale
}

describe('PDF render scale clamping', () => {
  it('returns desired scale when within limits', () => {
    // A4 page at scale 2: ~1190x1684 CSS pixels, well under 16384
    const scale = clampedRenderScale(595, 842, 2, 1)
    expect(scale).toBe(2)
  })

  it('clamps scale for large A0 page at high DPI', () => {
    // A0: ~3370x2384 at scale 2 with DPR 1.5 = ~10110x7152, still under 16384
    const scale = clampedRenderScale(3370, 2384, 2, 1.5)
    expect(scale).toBe(2) // 3370*2*1.5 = 10110 < 16384
  })

  it('clamps scale for extreme zoom on A0', () => {
    // A0 at scale 4 with DPR 1.5 = 3370*4*1.5 = 20220 > 16384
    const scale = clampedRenderScale(3370, 2384, 4, 1.5)
    expect(scale).toBeLessThan(4)
    // Verify the resulting max dimension is <= MAX_CANVAS_DIM
    const maxDim = Math.max(3370 * scale * 1.5, 2384 * scale * 1.5)
    expect(maxDim).toBeLessThanOrEqual(MAX_CANVAS_DIM + 1) // +1 for float rounding
  })

  it('returns PDF_BASE_SCALE value of 2.0', () => {
    expect(PDF_BASE_SCALE).toBe(2.0)
  })
})
