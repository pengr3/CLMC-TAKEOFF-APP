import type { StagePoint } from '../hooks/useCalibrationMode'

/**
 * Uniform grid-hash spatial index for markup snapping (spike-002, VALIDATED).
 *
 * Sibling pure-math module to markup-math.ts / arc-math.ts: takes StagePoint
 * inputs, imports NO React / NO Konva. The grid buckets points by
 * `floor(x/cell),floor(y/cell)`; a near query touches only the 3×3 cell
 * neighbourhood when `cell >= tolerance`. Vertices live in their single cell;
 * segments are inserted into EVERY cell their tolerance-padded bounding box
 * overlaps (the bbox-padded rule — endpoint-only buckets silently miss long
 * segments whose body crosses a cell with distant endpoints, per spike-002).
 *
 * Correctness is pinned to a brute-force linear scan over the same set
 * (0 mismatches). All inputs are finite-guarded (T-14-02-01): non-finite
 * vertices/segments are skipped at build, never surfaced by a query, never throw.
 *
 * Only vertex/endpoint and nearest-point-on-segment targets are built this phase
 * (D-05). Intersection-snap and grid-snap are deferred (D-06).
 */

/** A snap target returned by resolveSnap. */
export interface SnapCandidate {
  /** The snapped page-space point (vertex coord, or nearest point on segment). */
  point: StagePoint
  /** Discriminator: vertex/endpoint (□ per D-04) vs nearest-point-on-segment (△). */
  kind: 'vertex' | 'segment'
  /** Provenance — lets the caller apply D-07 exclusion rules. */
  markupId: string
  /** For kind='vertex': the vertex's index in its markup. */
  vertexIndex?: number
  /** For kind='segment': the segment's index in its markup. */
  segmentIndex?: number
}

interface VertexEntry {
  point: StagePoint
  markupId: string
  vertexIndex: number
}

interface SegmentEntry {
  a: StagePoint
  b: StagePoint
  markupId: string
  segmentIndex: number
}

export interface SnapIndex {
  readonly cell: number
  /** cellKey → vertices whose point falls in that cell. */
  readonly vertexCells: Map<string, VertexEntry[]>
  /** cellKey → segments whose padded bbox overlaps that cell. */
  readonly segmentCells: Map<string, SegmentEntry[]>
}

export interface BuildSnapIndexInput {
  vertices: Array<{ point: StagePoint; markupId: string; vertexIndex: number }>
  segments: Array<{ a: StagePoint; b: StagePoint; markupId: string; segmentIndex: number }>
  /** Cell size = zoom-compensated tolerance (~12 page units). Never < tolerance. */
  cell: number
}

export interface SnapExclude {
  /** The in-progress / edited markup whose vertices are restricted. */
  markupId: string
  /** If set, ONLY these vertex indices of `markupId` may snap (e.g. [0] = start). */
  allowVertexIndices?: number[]
  /** This vertex index of `markupId` is never returned (the dragged vertex). */
  blockVertexIndex?: number
}

function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`
}

function isFinitePoint(p: StagePoint): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y)
}

/**
 * Build a uniform grid hash. Each vertex is inserted into its single cell; each
 * segment is inserted into every cell its `cell`-padded bounding box overlaps so
 * a single-cell query at the cursor is exhaustive for on-segment hits.
 * Non-finite vertices/segments are skipped (never indexed).
 */
export function buildSnapIndex(input: BuildSnapIndexInput): SnapIndex {
  const cell = input.cell > 0 && Number.isFinite(input.cell) ? input.cell : 1
  const vertexCells = new Map<string, VertexEntry[]>()
  const segmentCells = new Map<string, SegmentEntry[]>()

  for (const v of input.vertices) {
    if (!isFinitePoint(v.point)) continue
    const cx = Math.floor(v.point.x / cell)
    const cy = Math.floor(v.point.y / cell)
    const key = cellKey(cx, cy)
    const bucket = vertexCells.get(key)
    const entry: VertexEntry = {
      point: v.point,
      markupId: v.markupId,
      vertexIndex: v.vertexIndex
    }
    if (bucket) bucket.push(entry)
    else vertexCells.set(key, [entry])
  }

  for (const s of input.segments) {
    if (!isFinitePoint(s.a) || !isFinitePoint(s.b)) continue
    const entry: SegmentEntry = {
      a: s.a,
      b: s.b,
      markupId: s.markupId,
      segmentIndex: s.segmentIndex
    }
    // Tolerance-padded bbox → cell range. Pad by one cell so the on-segment
    // tolerance band is covered even at the bbox edge.
    const minX = Math.min(s.a.x, s.b.x) - cell
    const maxX = Math.max(s.a.x, s.b.x) + cell
    const minY = Math.min(s.a.y, s.b.y) - cell
    const maxY = Math.max(s.a.y, s.b.y) + cell
    const cx0 = Math.floor(minX / cell)
    const cx1 = Math.floor(maxX / cell)
    const cy0 = Math.floor(minY / cell)
    const cy1 = Math.floor(maxY / cell)
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const key = cellKey(cx, cy)
        const bucket = segmentCells.get(key)
        if (bucket) bucket.push(entry)
        else segmentCells.set(key, [entry])
      }
    }
  }

  return { cell, vertexCells, segmentCells }
}

/** Squared distance helper (avoids sqrt in the inner loop). */
function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

/** Nearest point on segment a→b to cursor, plus the squared distance to it. */
function nearestOnSegment(
  cursor: StagePoint,
  a: StagePoint,
  b: StagePoint
): { point: StagePoint; d2: number } {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  let t = len2 === 0 ? 0 : ((cursor.x - a.x) * abx + (cursor.y - a.y) * aby) / len2
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const px = a.x + t * abx
  const py = a.y + t * aby
  return { point: { x: px, y: py }, d2: dist2(cursor.x, cursor.y, px, py) }
}

/**
 * Whether a vertex of the excluded markup is allowed to snap, per D-07:
 * the in-progress / edited markup contributes ONLY its allowed vertices (caller
 * passes `allowVertexIndices=[0]` for close-the-loop) and never the dragged vertex.
 */
function vertexAllowed(entry: VertexEntry, exclude?: SnapExclude): boolean {
  if (!exclude || entry.markupId !== exclude.markupId) return true
  if (exclude.blockVertexIndex !== undefined && entry.vertexIndex === exclude.blockVertexIndex) {
    return false
  }
  if (exclude.allowVertexIndices !== undefined) {
    return exclude.allowVertexIndices.includes(entry.vertexIndex)
  }
  return true
}

/**
 * Resolve the nearest snap target to `cursor` within `tol` page units.
 *
 * Scans the 3×3 vertex neighbourhood and the single cursor cell for bbox-indexed
 * segments. Among candidates within tolerance, vertices are preferred over
 * segments (D-04 □ over △); within a kind, nearest wins. Returns null when no
 * candidate is within tolerance.
 *
 * `exclude` applies the D-07 in-progress-markup rule (start-vertex-only +
 * dragged-vertex-block).
 */
export function resolveSnap(
  index: SnapIndex,
  cursor: StagePoint,
  tol: number,
  exclude?: SnapExclude
): SnapCandidate | null {
  if (!isFinitePoint(cursor)) return null
  const cell = index.cell
  const tol2 = tol * tol
  const cx = Math.floor(cursor.x / cell)
  const cy = Math.floor(cursor.y / cell)

  // --- Vertex pass: 3×3 neighbourhood. ---
  let bestVertex: VertexEntry | null = null
  let bestVertexD2 = tol2
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const bucket = index.vertexCells.get(cellKey(cx + dx, cy + dy))
      if (!bucket) continue
      for (const v of bucket) {
        if (!vertexAllowed(v, exclude)) continue
        const d2 = dist2(cursor.x, cursor.y, v.point.x, v.point.y)
        if (d2 <= bestVertexD2) {
          bestVertexD2 = d2
          bestVertex = v
        }
      }
    }
  }
  if (bestVertex) {
    return {
      point: bestVertex.point,
      kind: 'vertex',
      markupId: bestVertex.markupId,
      vertexIndex: bestVertex.vertexIndex
    }
  }

  // --- Segment pass: single cursor cell (bbox-padded index makes it exhaustive). ---
  let bestSeg: SegmentEntry | null = null
  let bestSegPoint: StagePoint | null = null
  let bestSegD2 = tol2
  const segBucket = index.segmentCells.get(cellKey(cx, cy))
  if (segBucket) {
    for (const s of segBucket) {
      // Excluded markup contributes no segment-snap (only its allowed vertices).
      if (exclude && s.markupId === exclude.markupId) continue
      const near = nearestOnSegment(cursor, s.a, s.b)
      if (near.d2 <= bestSegD2) {
        bestSegD2 = near.d2
        bestSeg = s
        bestSegPoint = near.point
      }
    }
  }
  if (bestSeg && bestSegPoint) {
    return {
      point: bestSegPoint,
      kind: 'segment',
      markupId: bestSeg.markupId,
      segmentIndex: bestSeg.segmentIndex
    }
  }

  return null
}
