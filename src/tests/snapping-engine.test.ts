import { describe, it, expect } from 'vitest'
import { buildSnapIndex, resolveSnap } from '@renderer/lib/snapping-engine'
import type { StagePoint } from '@renderer/hooks/useCalibrationMode'

// Spike-002 oracle-pinned tests.
// The correctness oracle is a brute-force linear scan over the SAME point set;
// the grid-hash result must match it for every query (0 mismatches).

/** Deterministic mulberry32 PRNG (spike-002 used the same family — no Math.random). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PAGE_W = 5000
const PAGE_H = 4000
const TOL = 12 // page units = 12px / zoom 1
const CELL = TOL

interface VertexInput {
  point: StagePoint
  markupId: string
  vertexIndex: number
}

function makeVertices(n: number, seed: number): VertexInput[] {
  const rng = mulberry32(seed)
  const out: VertexInput[] = []
  for (let i = 0; i < n; i++) {
    out.push({
      point: { x: rng() * PAGE_W, y: rng() * PAGE_H },
      markupId: `m${i % 17}`,
      vertexIndex: i % 5
    })
  }
  return out
}

/** Brute-force nearest vertex within tolerance — the correctness oracle. */
function bruteNearestVertex(
  vertices: VertexInput[],
  cursor: StagePoint,
  tol: number
): VertexInput | null {
  let best: VertexInput | null = null
  let bestD = tol
  for (const v of vertices) {
    if (!Number.isFinite(v.point.x) || !Number.isFinite(v.point.y)) continue
    const dx = v.point.x - cursor.x
    const dy = v.point.y - cursor.y
    const d = Math.hypot(dx, dy)
    if (d <= bestD) {
      bestD = d
      best = v
    }
  }
  return best
}

describe('buildSnapIndex / resolveSnap — vertex parity vs brute force', () => {
  it('N=1000: 0 mismatches over 2000 random cursor queries', () => {
    const vertices = makeVertices(1000, 12345)
    const index = buildSnapIndex({ vertices, segments: [], cell: CELL })
    const cursorRng = mulberry32(999)
    let mismatches = 0
    for (let q = 0; q < 2000; q++) {
      const cursor = { x: cursorRng() * PAGE_W, y: cursorRng() * PAGE_H }
      const got = resolveSnap(index, cursor, TOL)
      const oracle = bruteNearestVertex(vertices, cursor, TOL)
      if (oracle === null) {
        if (got !== null && got.kind === 'vertex') mismatches++
        continue
      }
      // Distance equivalence: the grid must return a vertex AT LEAST as near as the oracle.
      const od = Math.hypot(oracle.point.x - cursor.x, oracle.point.y - cursor.y)
      if (!got || got.kind !== 'vertex') {
        mismatches++
        continue
      }
      const gd = Math.hypot(got.point.x - cursor.x, got.point.y - cursor.y)
      if (gd > od + 1e-9) mismatches++
    }
    expect(mismatches).toBe(0)
  })

  it('N=10000: 0 mismatches over 2000 random cursor queries', () => {
    const vertices = makeVertices(10000, 6789)
    const index = buildSnapIndex({ vertices, segments: [], cell: CELL })
    const cursorRng = mulberry32(4242)
    let mismatches = 0
    for (let q = 0; q < 2000; q++) {
      const cursor = { x: cursorRng() * PAGE_W, y: cursorRng() * PAGE_H }
      const got = resolveSnap(index, cursor, TOL)
      const oracle = bruteNearestVertex(vertices, cursor, TOL)
      if (oracle === null) {
        if (got !== null && got.kind === 'vertex') mismatches++
        continue
      }
      const od = Math.hypot(oracle.point.x - cursor.x, oracle.point.y - cursor.y)
      if (!got || got.kind !== 'vertex') {
        mismatches++
        continue
      }
      const gd = Math.hypot(got.point.x - cursor.x, got.point.y - cursor.y)
      if (gd > od + 1e-9) mismatches++
    }
    expect(mismatches).toBe(0)
  })
})

describe('nearest-point-on-segment (bbox-padded vs endpoint-only)', () => {
  it('finds on-segment hits that an endpoint-only index would miss', () => {
    // Long horizontal segments whose endpoints are far from the cursor cell, but
    // whose body passes right under the cursor. An endpoint-only index buckets only
    // the endpoints, so a single-cell query at the cursor would miss the body hit.
    const segments = [
      { a: { x: 0, y: 1000 }, b: { x: 4000, y: 1000 }, markupId: 'seg', segmentIndex: 0 },
      { a: { x: 0, y: 2000 }, b: { x: 4000, y: 2000 }, markupId: 'seg', segmentIndex: 1 }
    ]
    const index = buildSnapIndex({ vertices: [], segments, cell: CELL })

    // Cursor in the middle of the page, 3 units above segment 0's body.
    const cursor = { x: 2000, y: 1003 }
    const got = resolveSnap(index, cursor, TOL)
    expect(got).not.toBeNull()
    expect(got!.kind).toBe('segment')
    // Snapped onto the segment body (y≈1000), nowhere near either endpoint.
    expect(got!.point.y).toBeCloseTo(1000, 6)
    expect(got!.point.x).toBeCloseTo(2000, 6)

    // Sanity: an endpoint-only nearest (only x=0 or x=4000 candidates) is >1900 away,
    // i.e. far outside TOL — proving the bbox-padded index found a body hit the naive
    // index could not.
    const endpointDist = Math.min(
      Math.hypot(0 - cursor.x, 1000 - cursor.y),
      Math.hypot(4000 - cursor.x, 1000 - cursor.y)
    )
    expect(endpointDist).toBeGreaterThan(TOL)
  })
})

describe('vertex preference over segment (D-04 □ over △)', () => {
  it('returns kind=vertex when a vertex and a segment are both within tolerance', () => {
    const vertices = [
      { point: { x: 100, y: 100 }, markupId: 'v', vertexIndex: 0 }
    ]
    const segments = [
      { a: { x: 90, y: 105 }, b: { x: 200, y: 105 }, markupId: 's', segmentIndex: 0 }
    ]
    const index = buildSnapIndex({ vertices, segments, cell: CELL })
    // Cursor near both: ~3 from vertex, ~2 from segment body.
    const got = resolveSnap(index, { x: 100, y: 103 }, TOL)
    expect(got).not.toBeNull()
    expect(got!.kind).toBe('vertex')
  })
})

describe('D-07 exclusion rules', () => {
  it('allowVertexIndices restricts the excluded markup to those indices only', () => {
    const vertices = [
      { point: { x: 100, y: 100 }, markupId: 'X', vertexIndex: 0 }, // start vertex
      { point: { x: 105, y: 100 }, markupId: 'X', vertexIndex: 1 }, // intermediate
      { point: { x: 110, y: 100 }, markupId: 'Y', vertexIndex: 3 }
    ]
    const index = buildSnapIndex({ vertices, segments: [], cell: CELL })
    // Cursor on top of the intermediate vertex (index 1) of markup X.
    const got = resolveSnap(index, { x: 105, y: 100 }, TOL, {
      markupId: 'X',
      allowVertexIndices: [0]
    })
    // Vertex 1 of X is excluded; the nearest ALLOWED candidate is X's start (idx 0)
    // or Y's vertex. Either way, no candidate from X may have vertexIndex !== 0.
    if (got && got.markupId === 'X') {
      expect(got.vertexIndex).toBe(0)
    }
    // And specifically: querying exactly at vertex 1 must NOT return X's vertex 1.
    expect(got?.markupId === 'X' && got?.vertexIndex === 1).toBe(false)
  })

  it('blockVertexIndex never returns that vertex of the excluded markup', () => {
    const vertices = [
      { point: { x: 100, y: 100 }, markupId: 'X', vertexIndex: 7 }
    ]
    const index = buildSnapIndex({ vertices, segments: [], cell: CELL })
    const got = resolveSnap(index, { x: 100, y: 100 }, TOL, {
      markupId: 'X',
      blockVertexIndex: 7
    })
    expect(got).toBeNull()
  })
})

describe('non-finite guard', () => {
  it('does not throw on Infinity vertex and never returns it', () => {
    const vertices = [
      { point: { x: Infinity, y: 100 }, markupId: 'bad', vertexIndex: 0 },
      { point: { x: 100, y: 100 }, markupId: 'good', vertexIndex: 0 }
    ]
    let index!: ReturnType<typeof buildSnapIndex>
    expect(() => {
      index = buildSnapIndex({ vertices, segments: [], cell: CELL })
    }).not.toThrow()
    const got = resolveSnap(index, { x: 100, y: 100 }, TOL)
    expect(got?.markupId).toBe('good')
    // No query can ever surface the bad vertex.
    const farFromGood = resolveSnap(index, { x: 9999, y: 9999 }, TOL)
    expect(farFromGood).toBeNull()
  })
})

describe('performance smoke', () => {
  it('10000 resolveSnap calls at N=10000 complete well under per-frame budget', () => {
    const vertices = makeVertices(10000, 555)
    const index = buildSnapIndex({ vertices, segments: [], cell: CELL })
    const cursorRng = mulberry32(7)
    const cursors: StagePoint[] = []
    for (let i = 0; i < 10000; i++) {
      cursors.push({ x: cursorRng() * PAGE_W, y: cursorRng() * PAGE_H })
    }
    const start = performance.now()
    for (const c of cursors) {
      resolveSnap(index, c, TOL)
    }
    const elapsed = performance.now() - start
    // Coarse O(n^2)-regression guard, NOT a microbenchmark. Spike measured ~2-4us/query
    // (~20-40ms for 10k) on the spatial-hash index; a regression to a linear scan
    // (O(n^2): 10000 queries x 10000 vertices) would take multiple SECONDS. The old
    // 100ms ceiling flaked under parallel-CI contention (observed ~101ms across
    // parallel vitest workers) despite passing reliably in isolation. 600ms keeps
    // ~15-30x headroom over normal runtime while staying far below a real regression.
    expect(elapsed).toBeLessThan(600)
  })
})
