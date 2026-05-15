/**
 * RED stubs — Wave 0: wallAreaM2 does not yet exist in markup-math.ts.
 * All tests in this file MUST FAIL at runtime (import is undefined).
 * TypeScript compiles cleanly because we import the module as a namespace
 * and access the export dynamically.
 */
import { describe, it, expect } from 'vitest'
import * as markupMath from '@renderer/lib/markup-math'

// Cast to access not-yet-exported wallAreaM2 without a compile error.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wallAreaM2 = (markupMath as any).wallAreaM2

describe('wallAreaM2', () => {
  it('is exported as a function', () => {
    // MUST FAIL — wallAreaM2 is not yet exported from markup-math.ts
    expect(typeof wallAreaM2).toBe('function')
  })

  it('computes 5m × 2.4m wall as 12 m²', () => {
    // 5000 px line at pixelsPerMm=1 → 5000mm = 5m; height=2400mm=2.4m; area=12m²
    // MUST FAIL — wallAreaM2 does not exist yet
    const points = [{ x: 0, y: 0 }, { x: 5000, y: 0 }]
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    expect(wallAreaM2(points, 2400, 1)).toBeCloseTo(12, 3)
  })

  it('zero-length polyline returns 0', () => {
    // MUST FAIL — wallAreaM2 does not exist yet
    const points = [{ x: 10, y: 10 }, { x: 10, y: 10 }]
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    expect(wallAreaM2(points, 2400, 1)).toBe(0)
  })
})
