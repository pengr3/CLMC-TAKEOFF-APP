import { describe, it, expect } from 'vitest'
import { polylineLength, polygonArea } from '@renderer/lib/markup-math'

// Spike-003b oracle-pinned tests for arc-aware area + length.
// arcs map is keyed by the segment's start-vertex index (edge i→i+1 keys on i;
// the closing edge n-1→0 of a closed polygon keys on n-1).

const L = 100
// CCW square: (0,0)->(L,0)->(L,L)->(0,L). Top edge is edge index 2 (v2→v3).
const SQUARE = [
  { x: 0, y: 0 },
  { x: L, y: 0 },
  { x: L, y: L },
  { x: 0, y: L }
]

describe('polygonArea — arc-aware (spike-003b named cases)', () => {
  it('plain square (no arcs arg) is unchanged: L² = 10000', () => {
    expect(polygonArea(SQUARE)).toBe(10000)
  })

  it('square + OUTWARD semicircle on top edge = 13926.9908', () => {
    // OUTWARD: apex away from interior (interior y<L) → apex at (50, 150)
    const arcs = { 2: { midX: 50, midY: 150 } }
    expect(polygonArea(SQUARE, arcs)).toBeCloseTo(13926.9908, 4)
  })

  it('square + INWARD semicircle on top edge = 6073.0092', () => {
    // INWARD: apex dips into interior → apex at (50, 50)
    const arcs = { 2: { midX: 50, midY: 50 } }
    expect(polygonArea(SQUARE, arcs)).toBeCloseTo(6073.0092, 4)
  })

  it('stadium (2 straight + 2 arc, W=200,H=80) = 21026.5482', () => {
    const W = 200
    const H = 80
    const R = H / 2
    const v = [
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: W, y: H },
      { x: 0, y: H }
    ]
    // right cap on edge 1 (v1→v2) apex (W+R, R); left cap on edge 3 (v3→v0) apex (-R, R)
    const arcs = {
      1: { midX: W + R, midY: R },
      3: { midX: -R, midY: R }
    }
    expect(polygonArea(v, arcs)).toBeCloseTo(21026.5482, 4)
  })

  it('winding-independence: reversing vertex order yields same magnitude (≤1e-9)', () => {
    const arcsCcw = { 2: { midX: 50, midY: 150 } }
    const ccw = polygonArea(SQUARE, arcsCcw)

    // Reverse vertices. The OUTWARD top edge (v2→v3 in CCW) becomes edge 0 (v0→v1)
    // in the reversed ring: reversed = (0,L),(L,L),(L,0),(0,0). The same physical
    // arc (apex 50,150) now sits on edge index 0.
    const reversed = [...SQUARE].reverse()
    const arcsCw = { 0: { midX: 50, midY: 150 } }
    const cw = polygonArea(reversed, arcsCw)
    expect(cw).toBeCloseTo(ccw, 9)
  })
})

describe('polylineLength — arc-aware', () => {
  it('plain polyline (no arcs arg) is unchanged: 3-4-5 = 5', () => {
    expect(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe(5)
  })

  it('quarter-circle edge ≈ true arc length and ~10% over the straight chord', () => {
    // Edge from p1=(2000,0) to p2=(0,2000), on-arc mid at 45° on R=2000 circle.
    const R = 2000
    const p1 = { x: R, y: 0 }
    const p2 = { x: 0, y: R }
    const mid = { x: R * Math.cos(Math.PI / 4), y: R * Math.sin(Math.PI / 4) }
    const arcs = { 0: { midX: mid.x, midY: mid.y } }
    const len = polylineLength([p1, p2], arcs)
    expect(len).toBeCloseTo(R * (Math.PI / 2), 3) // 3141.593
    const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y) // 2828.427
    // arc exceeds the straight chord by ~11.07% (313.166 / 2828.427)
    expect((len - chord) / chord).toBeCloseTo(0.1107, 3)
  })

  it('mixes straight + arc segments correctly', () => {
    // 3 points: straight (0,0)->(100,0) [len 100] then quarter-arc (100,0)->(100,200)
    const a = { x: 0, y: 0 }
    const b = { x: 100, y: 0 }
    const c = { x: 100, y: 200 }
    // arc on edge 1 (b→c), R=100 circle centered at (100,100)? Make a clean
    // semicircle-free quarter: center (100, 100) gives R=100 only if endpoints are
    // 100 apart from it. Use a known semicircle instead: edge b→c with mid bulged.
    // Simpler: just assert the straight-only edge 0 plus arc edge 1 > straight sum.
    const straightSum = polylineLength([a, b, c]) // 100 + 200 = 300
    const mid = { x: 150, y: 100 } // bulge edge 1 outward
    const arced = polylineLength([a, b, c], { 1: { midX: mid.x, midY: mid.y } })
    expect(arced).toBeGreaterThan(straightSum)
    // edge 0 (a→b) stays straight at exactly 100; arc edge 1 exceeds its 200 chord
    const arcEdgeLen = arced - 100
    expect(arcEdgeLen).toBeGreaterThan(200)
  })
})
