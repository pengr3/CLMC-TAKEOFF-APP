import { describe, it, expect } from 'vitest'
import {
  solveCircle,
  arcLength,
  circularSegmentMagnitude,
  buildArcAwareFlatPoints
} from '@renderer/lib/arc-math'
import type { StagePoint } from '@renderer/hooks/useCalibrationMode'

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
    expect(len).toBeCloseTo(3141.593, 3)
    const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y) // 2828.427…
    expect(chord).toBeCloseTo(2828.427, 3)
    // Spike-003 under-measurement: a straight takeoff under-reports by (arc−chord)/arc ≈ 9.968%
    const underMeasurePct = (len - chord) / len
    expect(underMeasurePct).toBeCloseTo(0.09968, 4)
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

// CR-01: measurement (arcLength) and rendering (buildArcAwareFlatPoints) must
// describe the SAME arc. Sum the sampled chord polyline and assert it converges
// to arcLength within sampling error, for cases that exercise the sweep
// tie-break: minor, near-π (semicircle boundary), and reflex (> π) arcs.
describe('CR-01: rendered arc matches measured arc length', () => {
  function chordSum(flat: number[]): number {
    let total = 0
    for (let i = 2; i < flat.length; i += 2) {
      const dx = flat[i] - flat[i - 2]
      const dy = flat[i + 1] - flat[i - 1]
      total += Math.hypot(dx, dy)
    }
    return total
  }

  // The sampled chord-sum always UNDER-estimates a convex arc; with 24 samples
  // the relative gap is bounded well under 1% even for a full near-2π reflex arc.
  function expectMatches(from: StagePoint, mid: StagePoint, to: StagePoint): void {
    const measured = arcLength(from, mid, to)
    const flat = buildArcAwareFlatPoints([from, to], { 0: { midX: mid.x, midY: mid.y } }, false)
    const rendered = chordSum(flat)
    expect(rendered).toBeGreaterThan(0)
    // Chord-sum ≤ true arc length; convergence within 1% at 24 samples.
    expect(rendered).toBeLessThanOrEqual(measured + 1e-6)
    expect(measured - rendered).toBeLessThan(measured * 0.01 + 1e-6)
  }

  it('minor arc (sweep < π)', () => {
    expectMatches({ x: 0, y: 0 }, { x: 30, y: 12 }, { x: 60, y: 0 })
  })

  it('semicircle boundary (sweep === π) — the exact tie-break case', () => {
    expectMatches({ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 })
  })

  it('reflex arc (sweep > π)', () => {
    const R = 100
    const a1 = (10 * Math.PI) / 180
    const a3 = (-10 * Math.PI) / 180
    const p1 = { x: R * Math.cos(a1), y: R * Math.sin(a1) }
    const p3 = { x: R * Math.cos(a3), y: R * Math.sin(a3) }
    const mid = { x: R * Math.cos(Math.PI), y: R * Math.sin(Math.PI) }
    expectMatches(p1, mid, p3)
  })

  it('randomized arcs (including near-π and reflex) — rendered ≈ measured', () => {
    let seed = 1234567
    const rand = (): number => {
      // Deterministic LCG so the property test is reproducible.
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    for (let k = 0; k < 200; k++) {
      const cx = (rand() - 0.5) * 20000
      const cy = (rand() - 0.5) * 20000
      const r = 50 + rand() * 5000
      const aStart = rand() * 2 * Math.PI
      // Sweep magnitude across the full (0, 2π) range to hit near-π and reflex.
      const sweepMag = 0.1 + rand() * (2 * Math.PI - 0.2)
      const dir = rand() < 0.5 ? 1 : -1
      const from = { x: cx + r * Math.cos(aStart), y: cy + r * Math.sin(aStart) }
      const aMid = aStart + dir * sweepMag * 0.5
      const aEnd = aStart + dir * sweepMag
      const mid = { x: cx + r * Math.cos(aMid), y: cy + r * Math.sin(aMid) }
      const to = { x: cx + r * Math.cos(aEnd), y: cy + r * Math.sin(aEnd) }
      const measured = arcLength(from, mid, to)
      if (measured === 0) continue
      const flat = buildArcAwareFlatPoints([from, to], { 0: { midX: mid.x, midY: mid.y } }, false)
      const rendered = chordSum(flat)
      // Chord-sum under-estimates; both describe the same arc within sampling error.
      expect(rendered).toBeLessThanOrEqual(measured + 1e-3)
      expect(measured - rendered).toBeLessThan(measured * 0.02 + 1e-3)
    }
  })
})
