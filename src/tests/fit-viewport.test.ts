import { describe, expect, it } from 'vitest'
import { calculateFitViewport } from '@renderer/lib/fit-viewport'

describe('fit while opening from the hidden Estimate canvas', () => {
  it.each([
    { width: 0, height: 0 },
    { width: 900, height: 0 },
    { width: 0, height: 600 },
    { width: 40, height: 600 },
    { width: 900, height: 39 },
    { width: Number.NaN, height: 600 },
    { width: 900, height: Number.POSITIVE_INFINITY }
  ])('defers a fit for unusable container %j', (container) => {
    expect(calculateFitViewport({ width: 600, height: 600 }, container)).toBeNull()
  })

  it('waits for a measurable canvas, then gives a centered positive fit', () => {
    const page = { width: 600, height: 600 }
    expect(calculateFitViewport(page, { width: 900, height: 0 })).toBeNull()
    const visible = calculateFitViewport(page, { width: 900, height: 480 })!
    expect(visible.zoom).toBeCloseTo(11 / 15)
    expect(visible.panX).toBeCloseTo(230)
    expect(visible.panY).toBeCloseTo(20)
    expect(visible.panY + 600 * visible.zoom).toBeCloseTo(460)
  })

  it('rejects absent or invalid page dimensions', () => {
    expect(calculateFitViewport(null, { width: 900, height: 600 })).toBeNull()
    for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(calculateFitViewport({ width, height: 600 }, { width: 900, height: 600 })).toBeNull()
    }
  })
})
