import { describe, it, expect } from 'vitest'
import { solveCircle, arcLength, circularSegmentMagnitude } from '@renderer/lib/arc-math'

// Spike-003 / 003b oracle-pinned tests.
// All geometry is page-space pixels (StagePoint {x,y}), exactly like polylineLength.

describe('solveCircle', () => {
  it('solves the circle through a semicircle (R=50)', () => {
    // p1=(0,0), mid=(50,50), p2=(100,0) → center (50,0), R=50
    const c = solveCircle({ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 })
    expect(c.collinear).toBe(false)
    expect(c.cx).toBeCloseTo(50, 9)
    expect(c.cy).toBeCloseTo(0, 9)
    expect(c.r).toBeCloseTo(50, 9)
    expect(c.sweep).toBeCloseTo(Math.PI, 9) // 180°
  })

  it('flags exactly collinear points as collinear', () => {
    const c = solveCircle({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 })
    expect(c.collinear).toBe(true)
  })

  it('returns a major arc (sweep > π) when the mid forces the long way', () => {
    // Center origin R=100; p1/p3 close (±10°), mid on the far side (180°)
    const R = 100
    const a1 = (10 * Math.PI) / 180
    const a3 = (-10 * Math.PI) / 180
    const p1 = { x: R * Math.cos(a1), y: R * Math.sin(a1) }
    const p3 = { x: R * Math.cos(a3), y: R * Math.sin(a3) }
    const mid = { x: R * Math.cos(Math.PI), y: R * Math.sin(Math.PI) }
    const c = solveCircle(p1, mid, p3)
    expect(c.collinear).toBe(false)
    expect(c.sweep).toBeGreaterThan(Math.PI)
    expect(c.r).toBeCloseTo(100, 6)
  })
})

describe('arcLength', () => {
  it('semicircle R=50 equals π·50 (157.0796…) within 1e-6', () => {
    const len = arcLength({ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 })
    expect(len).toBeCloseTo(Math.PI * 50, 6)
  })

  it('quarter-circle R=2000 (90°): ≈3141.593 px, ~9.97% over the 2828.427 chord', () => {
    // Center origin, R=2000; p1 at 0°, mid at 45°, p2 at 90°
    const R = 2000
    const p1 = { x: R, y: 0 }
    const mid = { x: R * Math.cos(Math.PI / 4), y: R * Math.sin(Math.PI / 4) }
    const p2 = { x: 0, y: R }
    const len = arcLength(p1, mid, p2)
    const trueArc = R * (Math.PI / 2)
    expect(len).toBeCloseTo(trueArc, 3) // 3141.5926…
    const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y) // 2828.427…
    const pctOver = (len - chord) / chord
    expect(pctOver).toBeCloseTo(0.0997, 3) // under-measurement closed: ~9.97%
  })

  it('major/reflex arc (sweep > 180°) matches the spike value 593.41 within 1e-6', () => {
    const R = 100
    const a1 = (10 * Math.PI) / 180
    const a3 = (-10 * Math.PI) / 180
    const p1 = { x: R * Math.cos(a1), y: R * Math.sin(a1) }
    const p3 = { x: R * Math.cos(a3), y: R * Math.sin(a3) }
    const mid = { x: R * Math.cos(Math.PI), y: R * Math.sin(Math.PI) }
    const len = arcLength(p1, mid, p3)
    // sweep = 340° → R·sweep = 100·(340π/180) = 593.4119456…
    expect(len).toBeCloseTo(100 * ((340 * Math.PI) / 180), 6)
    expect(len).toBeCloseTo(593.411946, 5)
  })

  it('collinear input falls back to the straight chord distance exactly', () => {
    const from = { x: 0, y: 0 }
    const mid = { x: 50, y: 0 }
    const to = { x: 100, y: 0 }
    const len = arcLength(from, mid, to)
    expect(len).toBe(Math.hypot(to.x - from.x, to.y - from.y)) // exactly 100
  })
})

describe('circularSegmentMagnitude', () => {
  it('outward semicircle R=50 equals (50²/2)·(π − sin π) = 1250·π within 1e-6', () => {
    const segMag = circularSegmentMagnitude({ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 })
    expect(segMag).toBeCloseTo(1250 * Math.PI, 6)
  })

  it('returns 0 for collinear input', () => {
    const segMag = circularSegmentMagnitude({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 })
    expect(segMag).toBe(0)
  })
})

describe('finite-guard (T-14-01-01 — malformed .clmc arc metadata)', () => {
  const NANS = [NaN, Infinity, -Infinity]

  it('arcLength returns a finite value for NaN/Infinity coordinates (no throw)', () => {
    for (const bad of NANS) {
      expect(Number.isFinite(arcLength({ x: bad, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }))).toBe(
        true
      )
      expect(
        Number.isFinite(arcLength({ x: 0, y: 0 }, { x: bad, y: 50 }, { x: 100, y: 0 }))
      ).toBe(true)
      expect(
        Number.isFinite(arcLength({ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: bad }))
      ).toBe(true)
    }
  })

  it('circularSegmentMagnitude returns a finite value for NaN/Infinity coordinates (no throw)', () => {
    for (const bad of NANS) {
      expect(
        Number.isFinite(
          circularSegmentMagnitude({ x: bad, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 })
        )
      ).toBe(true)
      expect(
        Number.isFinite(
          circularSegmentMagnitude({ x: 0, y: 0 }, { x: 50, y: bad }, { x: 100, y: 0 })
        )
      ).toBe(true)
    }
  })

  it('solveCircle returns collinear=true (finite fallback) for NaN/Infinity coordinates', () => {
    for (const bad of NANS) {
      const c = solveCircle({ x: bad, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 })
      expect(c.collinear).toBe(true)
    }
  })
})
