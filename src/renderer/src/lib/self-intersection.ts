import type { StagePoint } from '../hooks/useCalibrationMode'

/**
 * Closed-boundary self-intersection detector (spike-003b guard, §99-103).
 *
 * Sibling pure-math module to markup-math.ts: takes StagePoint inputs, imports
 * NO React / NO Konva. Treats `points` as a CLOSED boundary (edge i→(i+1)%n,
 * including the closing edge n-1→0) and runs the classic O(n²) segment-pair
 * crossing test over all NON-ADJACENT edge pairs. Adjacent edges share an
 * endpoint and must NOT count as a crossing (a normal polygon corner).
 *
 * This is the straight-chord boundary guard D-09 needs: the arc sagitta cap
 * (Wave 3) keeps most arcs from self-intersecting, so straight-vertex detection
 * is the load-bearing protection. Returns the FIRST crossing's two edge indices
 * plus the intersection point so D-09 can highlight the offending segments red,
 * or null if the boundary is simple. Non-finite input → null (never throws).
 *
 * Threat model: T-14-02-02 — bounded O(n²) loop; non-finite input short-circuits
 * to null; n is the markup's own vertex count (estimator-bounded).
 */

/**
 * Relative epsilon. The geometric tolerances below are SCALE-RELATIVE (derived
 * from the segment magnitudes), NOT this raw value (CR-02): an absolute 1e-9 is
 * meaningless at the tens-of-thousands-of-pixels page coordinates this app uses,
 * where float error in a "≈0, collinear" cross product can reach 1e-3–1e1. The
 * scale-relative derivation mirrors the proven `collinearTol = EPS·spread²`
 * pattern in arc-math.ts.
 */
const EPS = 1e-9

/** 2D cross product of (b−a)×(c−a) — signed twice-area of triangle abc. */
function cross(a: StagePoint, b: StagePoint, c: StagePoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

/**
 * Length scale shared by a pair of segments p1→p2 and p3→p4 — the largest
 * extent involved. Used to derive scale-relative tolerances (CR-02). Floors at 1
 * so degenerate (zero-length) inputs never produce a zero tolerance.
 */
function pairScale(p1: StagePoint, p2: StagePoint, p3: StagePoint, p4: StagePoint): number {
  return (
    Math.max(
      Math.hypot(p2.x - p1.x, p2.y - p1.y),
      Math.hypot(p4.x - p3.x, p4.y - p3.y),
      Math.hypot(p3.x - p1.x, p3.y - p1.y),
      Math.hypot(p4.x - p2.x, p4.y - p2.y)
    ) || 1
  )
}

/**
 * Is point p (known collinear with a→b) within the a→b bounding box? The pad is
 * SCALE-RELATIVE (`EPS·scale`) so it absorbs float rounding at page-scale
 * coordinates instead of the meaningless absolute 1e-9 px (CR-02).
 */
function onSegment(a: StagePoint, b: StagePoint, p: StagePoint, scale: number): boolean {
  const pad = EPS * scale
  return (
    Math.min(a.x, b.x) - pad <= p.x &&
    p.x <= Math.max(a.x, b.x) + pad &&
    Math.min(a.y, b.y) - pad <= p.y &&
    p.y <= Math.max(a.y, b.y) + pad
  )
}

/**
 * Sign of a cross product (twice-area, units²) against a SCALE-RELATIVE zero
 * tolerance `EPS·scale²` (CR-02) — mirrors arc-math.ts's `collinearTol`. A true
 * collinear triple reads 0 even when float error inflates the raw value to
 * 1e-3–1e1 at page scale; a genuine crossing's ~1e6–1e8 cross product still
 * reads ±1.
 */
function sign(v: number, scale: number): number {
  const tol = EPS * scale * scale
  if (v > tol) return 1
  if (v < -tol) return -1
  return 0
}

/**
 * Compute the intersection point of two segments p1→p2 and p3→p4 that are known
 * to cross. Falls back to a shared collinear-overlap endpoint when the lines are
 * parallel (denominator ~0).
 */
function intersectionPoint(
  p1: StagePoint,
  p2: StagePoint,
  p3: StagePoint,
  p4: StagePoint
): StagePoint {
  const d1x = p2.x - p1.x
  const d1y = p2.y - p1.y
  const d2x = p4.x - p3.x
  const d2y = p4.y - p3.y
  const denom = d1x * d2y - d1y * d2x
  // Scale-relative parallel test (CR-02): denom is a cross product (units²).
  const scale = pairScale(p1, p2, p3, p4)
  if (Math.abs(denom) < EPS * scale * scale) {
    // Collinear overlap — report the overlapping endpoint of p3/p4 that lies on p1→p2.
    if (onSegment(p1, p2, p3, scale)) return { x: p3.x, y: p3.y }
    return { x: p4.x, y: p4.y }
  }
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom
  return { x: p1.x + t * d1x, y: p1.y + t * d1y }
}

/**
 * Standard segment-intersection predicate (sign of cross products). Returns true
 * when p1→p2 and p3→p4 intersect, INCLUDING collinear overlap (the spike requires
 * collinear-overlap to count as a crossing).
 */
function segmentsCross(
  p1: StagePoint,
  p2: StagePoint,
  p3: StagePoint,
  p4: StagePoint
): boolean {
  // Scale-relative tolerance shared by all four orientation tests (CR-02).
  const scale = pairScale(p1, p2, p3, p4)
  const d1 = sign(cross(p3, p4, p1), scale)
  const d2 = sign(cross(p3, p4, p2), scale)
  const d3 = sign(cross(p1, p2, p3), scale)
  const d4 = sign(cross(p1, p2, p4), scale)

  if (d1 !== d2 && d3 !== d4) return true

  // Collinear-overlap cases: an endpoint of one segment lies on the other.
  if (d1 === 0 && onSegment(p3, p4, p1, scale)) return true
  if (d2 === 0 && onSegment(p3, p4, p2, scale)) return true
  if (d3 === 0 && onSegment(p1, p2, p3, scale)) return true
  if (d4 === 0 && onSegment(p1, p2, p4, scale)) return true

  return false
}

function allFinite(points: StagePoint[]): boolean {
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false
  }
  return true
}

/**
 * Detect the first self-crossing of a closed boundary. Edges are i→(i+1)%n.
 * Returns `{ i, j, point }` (the two crossing edge indices and the intersection),
 * or null if the boundary is simple, has fewer than 4 vertices, or contains any
 * non-finite coordinate.
 */
export function findSelfIntersection(
  points: StagePoint[]
): { i: number; j: number; point: StagePoint } | null {
  const n = points.length
  // A triangle (3 closed edges) cannot self-intersect; fewer points likewise.
  if (n < 4) return null
  if (!allFinite(points)) return null

  for (let i = 0; i < n; i++) {
    const a1 = points[i]
    const a2 = points[(i + 1) % n]
    for (let j = i + 1; j < n; j++) {
      // Skip adjacent edges (share an endpoint) — they are not a crossing.
      // Edge i and edge i+1 share a vertex; edge 0 and edge n-1 share vertex 0.
      if (j === i) continue
      if (j === (i + 1) % n) continue
      if (i === (j + 1) % n) continue

      const b1 = points[j]
      const b2 = points[(j + 1) % n]
      if (segmentsCross(a1, a2, b1, b2)) {
        return { i, j, point: intersectionPoint(a1, a2, b1, b2) }
      }
    }
  }

  return null
}
