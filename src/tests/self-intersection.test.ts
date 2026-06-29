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
