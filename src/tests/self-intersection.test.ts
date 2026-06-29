import { describe, it, expect } from 'vitest'
import { findSelfIntersection } from '@renderer/lib/self-intersection'
import type { StagePoint } from '@renderer/hooks/useCalibrationMode'

// Closed-boundary self-crossing detector (spike-003b §99-103 guard).
// Analytic crossing points are the correctness oracle.

describe('findSelfIntersection — simple (no crossing)', () => {
  it('a convex quad returns null', () => {
    const quad: StagePoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ]
    expect(findSelfIntersection(quad)).toBeNull()
  })

  it('adjacent edges sharing a vertex (a normal corner) are NOT a crossing', () => {
    // A simple triangle's corners share vertices but never self-cross.
    const tri: StagePoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 0 }
    ]
    expect(findSelfIntersection(tri)).toBeNull()
  })

  it('fewer than 4 points returns null (a triangle cannot self-intersect)', () => {
    expect(findSelfIntersection([{ x: 0, y: 0 }])).toBeNull()
    expect(findSelfIntersection([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBeNull()
    expect(
      findSelfIntersection([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }])
    ).toBeNull()
  })
})

describe('findSelfIntersection — bowtie / figure-eight', () => {
  it('returns the two crossing edge indices and the analytic intersection point', () => {
    // Vertices ordered so edge 0 (v0→v1) crosses edge 2 (v2→v3).
    // v0=(0,0) v1=(100,100) v2=(100,0) v3=(0,100). Closed: also edge 3 (v3→v0).
    // Edge 0: (0,0)→(100,100); Edge 2: (100,0)→(0,100) — they cross at (50,50).
    const bowtie: StagePoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 }
    ]
    const hit = findSelfIntersection(bowtie)
    expect(hit).not.toBeNull()
    // The two crossing edges are 0 and 2 (non-adjacent).
    const pair = [hit!.i, hit!.j].sort((a, b) => a - b)
    expect(pair).toEqual([0, 2])
    expect(hit!.point.x).toBeCloseTo(50, 6)
    expect(hit!.point.y).toBeCloseTo(50, 6)
  })
})

describe('findSelfIntersection — collinear / self-touching', () => {
  it('detects a vertex lying exactly on a non-adjacent edge (collinear overlap)', () => {
    // A boundary where the closing edge passes back through an earlier edge's line.
    // Square-ish ring with a spike that lands a vertex on the opposite edge.
    // v0=(0,0) v1=(100,0) v2=(50,0) [on edge v0→v1 line] v3=(50,100)
    // Edge v3→v0 (closing) and edge v0→v1 share v0 (adjacent). But edge v1→v2
    // overlaps edge v0→v1's line collinearly between x=50 and x=100.
    const ring: StagePoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 100 }
    ]
    const hit = findSelfIntersection(ring)
    expect(hit).not.toBeNull()
  })
})

// CR-02: the geometric epsilon must be SCALE-RELATIVE. At page-scale coordinates
// (tens of thousands of px) an absolute 1e-9 tolerance made the collinear/grazing
// branch unreliable: a "≈0, collinear" cross product reads 1e-3–1e1 from float
// error, and the ±1e-9 px onSegment pad cannot absorb rounding on large coords.
describe('findSelfIntersection — page-scale coordinates (0–30000 px)', () => {
  it('detects a bowtie quad (clean X) at page scale', () => {
    // Same topology as the small bowtie, scaled to 30k px.
    const bowtie: StagePoint[] = [
      { x: 0, y: 0 },
      { x: 30000, y: 30000 },
      { x: 30000, y: 0 },
      { x: 0, y: 30000 }
    ]
    const hit = findSelfIntersection(bowtie)
    expect(hit).not.toBeNull()
    const pair = [hit!.i, hit!.j].sort((a, b) => a - b)
    expect(pair).toEqual([0, 2])
    expect(hit!.point.x).toBeCloseTo(15000, 3)
    expect(hit!.point.y).toBeCloseTo(15000, 3)
  })

  it('detects a T-junction where a vertex lands on a non-adjacent edge at page scale', () => {
    // Edge v1→v2 is collinear with (and overlaps) edge v0→v1's line between
    // x=15000 and x=30000 — a self-touching boundary that must be blocked.
    const ring: StagePoint[] = [
      { x: 0, y: 0 },
      { x: 30000, y: 0 },
      { x: 15000, y: 0 },
      { x: 15000, y: 22000 }
    ]
    const hit = findSelfIntersection(ring)
    expect(hit).not.toBeNull()
  })

  it('does NOT false-positive on a simple convex quad at page scale (near-miss)', () => {
    // A large convex quad whose edges come close but never cross. With an
    // absolute 1e-9 epsilon the orientation signs are still correct here, but
    // this pins that the scale-relative tolerance does not over-trigger.
    const quad: StagePoint[] = [
      { x: 100, y: 100 },
      { x: 29900, y: 200 },
      { x: 29800, y: 19900 },
      { x: 150, y: 20000 }
    ]
    expect(findSelfIntersection(quad)).toBeNull()
  })

  it('does NOT false-positive when two edges pass within a few px without crossing', () => {
    // Two arms of an open-ish ring that graze (gap ~10px) at page scale. A
    // collinear-overlap false positive here would block a legitimate boundary.
    const ring: StagePoint[] = [
      { x: 0, y: 0 },
      { x: 30000, y: 0 },
      { x: 30000, y: 10000 },
      { x: 10, y: 10000 } // returns just 10px shy of x=0, no crossing
    ]
    expect(findSelfIntersection(ring)).toBeNull()
  })
})

describe('findSelfIntersection — non-finite guard', () => {
  it('returns null (no throw) when a ring point is non-finite', () => {
    const bad: StagePoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: Infinity, y: 0 },
      { x: 0, y: 100 }
    ]
    expect(() => findSelfIntersection(bad)).not.toThrow()
    expect(findSelfIntersection(bad)).toBeNull()
  })
})
