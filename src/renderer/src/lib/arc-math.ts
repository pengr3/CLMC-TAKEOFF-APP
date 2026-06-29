import type { StagePoint } from '../hooks/useCalibrationMode'
import { euclideanDistance } from './scale-math'

/**
 * Pure 3-point circular-arc geometry (page-space pixels), validated against the
 * spike-003 / spike-003b numerical oracles (max relative error ~1e-10 / ~1e-8).
 *
 * Sibling pure-math module to markup-math.ts: takes StagePoint inputs, returns
 * numbers, imports NO React / NO Konva. Every public function is finite-guarded
 * against malformed save-file arc metadata (T-14-01-01) — NaN / Infinity inputs
 * fall back to the straight-chord / zero result, never throw, never loop.
 */

/** Scale-aware collinearity epsilon (mirrors the spike's EPS). */
const EPS = 1e-9

/** All coordinates of the three points must be finite numbers. */
function allFinite(p1: StagePoint, mid: StagePoint, p2: StagePoint): boolean {
  return (
    Number.isFinite(p1.x) &&
    Number.isFinite(p1.y) &&
    Number.isFinite(mid.x) &&
    Number.isFinite(mid.y) &&
    Number.isFinite(p2.x) &&
    Number.isFinite(p2.y)
  )
}

export interface CircleSolution {
  cx: number
  cy: number
  r: number
  /** CCW sweep angle (radians) of the arc through `mid`, in (0, 2π). 0 when collinear. */
  sweep: number
  collinear: boolean
}

const COLLINEAR: CircleSolution = { cx: NaN, cy: NaN, r: Infinity, sweep: 0, collinear: true }

/**
 * Solve the circle through three page-space points and disambiguate the arc that
 * passes THROUGH `mid` (handles major / reflex sweeps > π).
 *
 * Perpendicular-bisector determinant solve: `d = 2·signedArea(p1,mid,p2)`.
 * When `|d|` is below a scale-aware tolerance the points are (near-)collinear —
 * returns `collinear: true` (callers fall back to the straight chord). Also
 * returns collinear for any NaN / Infinity input coordinate (defensive guard).
 */
export function solveCircle(p1: StagePoint, mid: StagePoint, p2: StagePoint): CircleSolution {
  if (!allFinite(p1, mid, p2)) return COLLINEAR

  const ax = p1.x
  const ay = p1.y
  const bx = mid.x
  const by = mid.y
  const cx = p2.x
  const cy = p2.y

  // d = 2 * signed area of triangle (a,b,c) — zero when collinear.
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))

  // Scale-aware collinearity test: compare |d| (~2*area) to the squared spread.
  const spread =
    Math.max(
      euclideanDistance(ax, ay, bx, by),
      euclideanDistance(bx, by, cx, cy),
      euclideanDistance(ax, ay, cx, cy)
    ) || 1
  const collinearTol = EPS * spread * spread

  if (Math.abs(d) <= collinearTol) return COLLINEAR

  const a2 = ax * ax + ay * ay
  const b2 = bx * bx + by * by
  const c2 = cx * cx + cy * cy

  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d
  const r = euclideanDistance(ux, uy, ax, ay)

  if (!Number.isFinite(ux) || !Number.isFinite(uy) || !Number.isFinite(r)) return COLLINEAR

  // Disambiguate major vs minor: the arc through `mid` is the one whose CCW
  // sweep from p1 reaches mid before p2.
  const a1 = Math.atan2(ay - uy, ax - ux)
  const aMid = Math.atan2(by - uy, bx - ux)
  const aEnd = Math.atan2(cy - uy, cx - ux)

  const ccw = (from: number, to: number): number => {
    let delta = to - from
    while (delta < 0) delta += 2 * Math.PI
    while (delta >= 2 * Math.PI) delta -= 2 * Math.PI
    return delta
  }

  const sweepToMid = ccw(a1, aMid)
  const sweepToEnd = ccw(a1, aEnd)
  const sweep = sweepToMid < sweepToEnd ? sweepToEnd : 2 * Math.PI - sweepToEnd

  return { cx: ux, cy: uy, r, sweep, collinear: false }
}

/**
 * True length of the arc from `from` through `mid` to `to` = `R · sweep`.
 * Falls back to the straight chord distance `|to − from|` when the three points
 * are collinear or any coordinate is non-finite (defensive guard).
 */
export function arcLength(from: StagePoint, mid: StagePoint, to: StagePoint): number {
  const chord = euclideanDistance(from.x, from.y, to.x, to.y)
  const safeChord = Number.isFinite(chord) ? chord : 0 // non-finite endpoint → 0 (T-14-01-01)
  const c = solveCircle(from, mid, to)
  if (c.collinear) return safeChord
  const len = c.r * c.sweep
  return Number.isFinite(len) ? len : safeChord
}

/**
 * Clamp a dragged on-arc point to the sagitta cap of its edge (D-08 / D-09
 * fallback). The on-arc midpoint may move freely ALONG the chord but its
 * PERPENDICULAR offset (the sagitta) is capped at `|chord|/2` — the semicircle
 * limit. Past that the arc sweeps > π and risks folding the boundary on itself;
 * the sagitta cap stops the drag there (the caller turns the guide amber).
 *
 * Returns the (possibly clamped) point plus a `clamped` flag so the caller can
 * surface the amber sagitta-cap feedback. Geometry is pure (page-space pixels),
 * finite-guarded: any non-finite input returns the raw point unclamped.
 */
export function clampBulgeToSagittaCap(
  from: StagePoint,
  to: StagePoint,
  dragged: StagePoint
): { point: StagePoint; clamped: boolean } {
  if (
    !Number.isFinite(from.x) ||
    !Number.isFinite(from.y) ||
    !Number.isFinite(to.x) ||
    !Number.isFinite(to.y) ||
    !Number.isFinite(dragged.x) ||
    !Number.isFinite(dragged.y)
  ) {
    return { point: dragged, clamped: false }
  }

  const chordX = to.x - from.x
  const chordY = to.y - from.y
  const chordLen = Math.hypot(chordX, chordY)
  // Degenerate chord (endpoints coincide) → no meaningful cap; pass through.
  if (chordLen < EPS) return { point: dragged, clamped: false }

  // Chord midpoint and unit perpendicular.
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  const perpX = -chordY / chordLen
  const perpY = chordX / chordLen

  // Decompose the dragged point relative to the chord midpoint into a tangential
  // (along chord) and a perpendicular (sagitta) component.
  const relX = dragged.x - midX
  const relY = dragged.y - midY
  const tangential = (relX * chordX + relY * chordY) / chordLen // signed along chord
  const sagitta = relX * perpX + relY * perpY // signed perpendicular offset

  const maxSagitta = chordLen / 2
  if (Math.abs(sagitta) <= maxSagitta) {
    return { point: dragged, clamped: false }
  }

  const cappedSagitta = Math.sign(sagitta) * maxSagitta
  const tangX = chordX / chordLen
  const tangY = chordY / chordLen
  const cappedX = midX + tangential * tangX + cappedSagitta * perpX
  const cappedY = midY + tangential * tangY + cappedSagitta * perpY
  return { point: { x: cappedX, y: cappedY }, clamped: true }
}

/**
 * Re-solve an arc edge's on-arc midpoint when one of its ENDPOINTS moves (D-08
 * endpoint re-solve). The curve "follows the corner": the new mid preserves the
 * old mid's TANGENTIAL ratio (position along the chord) and PERPENDICULAR sagitta
 * (signed offset from the chord) relative to the NEW chord. This keeps the arc's
 * bend direction and depth consistent as the corner is dragged.
 *
 * `oldFrom`/`oldTo` are the edge endpoints BEFORE the move; `oldMid` is the
 * current on-arc midpoint; `newFrom`/`newTo` are the endpoints AFTER the move
 * (one of them changed). Returns the re-solved mid. Finite-guarded and
 * degenerate-chord-guarded: a zero-length old chord returns the new chord
 * midpoint (a straight-ish fallback).
 */
export function resolveArcMidForMovedEndpoint(
  oldFrom: StagePoint,
  oldTo: StagePoint,
  oldMid: StagePoint,
  newFrom: StagePoint,
  newTo: StagePoint
): { midX: number; midY: number } {
  const newMidX = (newFrom.x + newTo.x) / 2
  const newMidY = (newFrom.y + newTo.y) / 2

  const oldChordX = oldTo.x - oldFrom.x
  const oldChordY = oldTo.y - oldFrom.y
  const oldChordLen = Math.hypot(oldChordX, oldChordY)
  if (!Number.isFinite(oldChordLen) || oldChordLen < EPS) {
    return { midX: newMidX, midY: newMidY }
  }

  // Decompose oldMid relative to the OLD chord into tangential ratio + sagitta.
  const oMidX = (oldFrom.x + oldTo.x) / 2
  const oMidY = (oldFrom.y + oldTo.y) / 2
  const relX = oldMid.x - oMidX
  const relY = oldMid.y - oMidY
  const tangRatio = (relX * oldChordX + relY * oldChordY) / (oldChordLen * oldChordLen)
  const sagitta = (relX * -oldChordY + relY * oldChordX) / oldChordLen // signed perp offset

  // Re-apply to the NEW chord.
  const newChordX = newTo.x - newFrom.x
  const newChordY = newTo.y - newFrom.y
  const newChordLen = Math.hypot(newChordX, newChordY)
  if (!Number.isFinite(newChordLen) || newChordLen < EPS) {
    return { midX: newMidX, midY: newMidY }
  }
  const perpX = -newChordY / newChordLen
  const perpY = newChordX / newChordLen
  const midX = newMidX + tangRatio * newChordX + sagitta * perpX
  const midY = newMidY + tangRatio * newChordY + sagitta * perpY
  if (!Number.isFinite(midX) || !Number.isFinite(midY)) {
    return { midX: newMidX, midY: newMidY }
  }
  return { midX, midY }
}

/** Per-edge arc midpoints, keyed by the segment's start-vertex index. */
type ArcMidMap = Record<number, { midX: number; midY: number }>

/** Samples per arc edge for on-canvas rendering — matches ArcPreview's density. */
const RENDER_ARC_SAMPLES = 24

/**
 * Sample `count` interior+boundary points along the solved circle from `from`
 * to `to`, walking the way that passes THROUGH `mid` (so major / reflex arcs are
 * rendered the long way round, matching solveCircle's sweep disambiguation).
 * Returns a flat [x0,y0,...] array INCLUDING both endpoints. Falls back to the
 * straight 2-point chord on collinear / non-finite input (never a NaN-radius arc).
 */
function sampleArcEdge(
  from: StagePoint,
  mid: StagePoint,
  to: StagePoint,
  count: number
): number[] {
  const c = solveCircle(from, mid, to)
  if (c.collinear) return [from.x, from.y, to.x, to.y]

  const aStart = Math.atan2(from.y - c.cy, from.x - c.cx)
  const aEnd = Math.atan2(to.y - c.cy, to.x - c.cx)
  const aMid = Math.atan2(mid.y - c.cy, mid.x - c.cx)

  const ccw = (a: number, b: number): number => {
    let d = b - a
    while (d < 0) d += 2 * Math.PI
    while (d >= 2 * Math.PI) d -= 2 * Math.PI
    return d
  }
  const ccwToMid = ccw(aStart, aMid)
  const ccwToEnd = ccw(aStart, aEnd)
  const goCcw = ccwToMid <= ccwToEnd
  const sweep = goCcw ? ccwToEnd : -(2 * Math.PI - ccwToEnd)

  const out: number[] = []
  for (let i = 0; i <= count; i++) {
    const a = aStart + (sweep * i) / count
    const x = c.cx + c.r * Math.cos(a)
    const y = c.cy + c.r * Math.sin(a)
    if (Number.isFinite(x) && Number.isFinite(y)) out.push(x, y)
  }
  // Defensive: degenerate sample → straight chord.
  if (out.length < 4) return [from.x, from.y, to.x, to.y]
  return out
}

/**
 * Build a flat Konva-`Line` point array [x0,y0,x1,y1,...] for a markup whose
 * edges may be circular arcs. For every segment i→i+1 that has an `arcs[i]`
 * entry, the path follows the sampled arc curve THROUGH the on-arc midpoint;
 * segments without an arc entry stay straight (just the two endpoints).
 *
 * `closed=true` (area / perimeter) appends the closing edge n-1→0, which keys
 * its arc on index n-1 (14-01 contract). `closed=false` (linear / wall) renders
 * only the open polyline edges. The on-canvas drawn shape thus matches the
 * arc-aware BOQ quantity exactly. Pure, finite-guarded (degrades to straight).
 */
export function buildArcAwareFlatPoints(
  points: StagePoint[],
  arcs: ArcMidMap | undefined,
  closed: boolean
): number[] {
  const n = points.length
  if (n === 0) return []
  if (n === 1) return [points[0].x, points[0].y]

  // No arcs → fast path: the plain flattened chord polyline (byte-identical to
  // the previous straight renderer output).
  if (!arcs) {
    const flat: number[] = []
    for (const p of points) flat.push(p.x, p.y)
    return flat
  }

  const flat: number[] = [points[0].x, points[0].y]
  const lastEdge = closed ? n : n - 1
  for (let i = 0; i < lastEdge; i++) {
    const from = points[i]
    const to = points[(i + 1) % n]
    const arc = arcs[i]
    if (arc) {
      const sampled = sampleArcEdge(from, { x: arc.midX, y: arc.midY }, to, RENDER_ARC_SAMPLES)
      // sampled includes the start point (already pushed for i=0; for i>0 it is
      // the previous edge's endpoint) → skip its first coordinate pair.
      for (let k = 2; k < sampled.length; k++) flat.push(sampled[k])
    } else {
      flat.push(to.x, to.y)
    }
  }
  return flat
}

/**
 * Magnitude of the circular-segment area between the chord and its arc:
 * `(R²/2)·(sweep − sin(sweep))`. Holds for major arcs (sweep > π) too.
 * Returns 0 when collinear / degenerate / non-finite (the area calc adds no
 * correction for a straight edge). Sign is applied by the caller (polygonArea).
 */
export function circularSegmentMagnitude(
  from: StagePoint,
  mid: StagePoint,
  to: StagePoint
): number {
  const c = solveCircle(from, mid, to)
  if (c.collinear) return 0
  const segMag = (c.r * c.r) / 2 * (c.sweep - Math.sin(c.sweep))
  return Number.isFinite(segMag) ? segMag : 0
}
