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
