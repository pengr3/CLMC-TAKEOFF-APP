import type { StagePoint } from '../hooks/useCalibrationMode'
import type { ScaleUnit } from '../types/scale'
import { MM_PER_UNIT } from '../types/scale'
import { euclideanDistance, fromMm } from './scale-math'
import { LABEL_FONT_BASE, LABEL_FONT_FLOOR } from '../types/markup'
import { arcLength, circularSegmentMagnitude } from './arc-math'

/** Per-edge arc midpoints, keyed by the segment's start-vertex index. */
type ArcMap = Record<number, { midX: number; midY: number }>

/**
 * Total length of a polyline. Arc-aware: pass an optional per-edge `arcs` map
 * (keyed by the segment start-vertex index) to measure curved edges by their
 * true arc length (R·sweep) instead of the straight chord. Edges without an arc
 * entry use the straight chord. The single-arg form is preserved verbatim for
 * straight callers (boq-aggregator, save/load) — load-bearing back-compat.
 */
export function polylineLength(points: StagePoint[], arcs?: ArcMap): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]
    const to = points[i]
    const arc = arcs?.[i - 1]
    if (arc) {
      total += arcLength(from, { x: arc.midX, y: arc.midY }, to)
    } else {
      total += euclideanDistance(from.x, from.y, to.x, to.y)
    }
  }
  return total
}

/**
 * Enclosed area of a closed polygon. Arc-aware: pass an optional per-edge `arcs`
 * map to apply the circular-segment correction for curved edges. The closing
 * edge n-1→0 keys on index n-1.
 *
 * Sign rule (spike-003b, load-bearing): accumulate the DOUBLED signed shoelace
 * `2·S` (no pre-abs); for each arc edge subtract `sign(cross)·2·segMag` where
 * `cross = (to−from)×(mid−from)` and `segMag = (R²/2)(θ−sinθ)`; take `abs` at the
 * very end → winding-independent, correct for both OUTWARD and INWARD bulges
 * (OUTWARD ⟺ sign(cross) ≠ sign(2·S)). The single-arg form is preserved verbatim
 * for straight callers.
 */
export function polygonArea(points: StagePoint[], arcs?: ArcMap): number {
  if (points.length < 3) return 0
  const n = points.length
  // Doubled signed shoelace (NOT pre-absed — the sign drives the arc correction).
  let doubled = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    doubled += points[i].x * points[j].y
    doubled -= points[j].x * points[i].y
  }
  if (arcs) {
    for (let i = 0; i < n; i++) {
      const arc = arcs[i]
      if (!arc) continue
      const from = points[i]
      const to = points[(i + 1) % n]
      const mid = { x: arc.midX, y: arc.midY }
      const cross = (to.x - from.x) * (mid.y - from.y) - (to.y - from.y) * (mid.x - from.x)
      const segMag = circularSegmentMagnitude(from, mid, to)
      doubled -= Math.sign(cross) * 2 * segMag
    }
  }
  return Math.abs(doubled) / 2
}

export function polygonCentroid(points: StagePoint[]): StagePoint {
  if (points.length === 0) return { x: 0, y: 0 }
  let cx = 0,
    cy = 0
  for (const p of points) {
    cx += p.x
    cy += p.y
  }
  return { x: cx / points.length, y: cy / points.length }
}

export function pixelLengthToReal(pixelLen: number, pixelsPerMm: number, unit: ScaleUnit): number {
  if (pixelsPerMm <= 0) throw new Error('pixelsPerMm must be positive')
  const mm = pixelLen / pixelsPerMm
  return fromMm(mm, unit)
}

export function pixelAreaToReal(pixelArea: number, pixelsPerMm: number, unit: ScaleUnit): number {
  if (pixelsPerMm <= 0) throw new Error('pixelsPerMm must be positive')
  const mm2 = pixelArea / (pixelsPerMm * pixelsPerMm)
  const mmPerUnit = MM_PER_UNIT[unit]
  return mm2 / (mmPerUnit * mmPerUnit)
}

export function labelFontSize(currentZoom: number): number {
  return Math.max(LABEL_FONT_BASE / currentZoom, LABEL_FONT_FLOOR)
}

/**
 * Wall area in square metres. Length = polyline arc length in mm; height = wallHeightMm.
 * D-12: walls always produce m² regardless of project globalUnit.
 * Uses inline mm→m conversion to avoid dependence on 'm' as a valid ScaleUnit (Assumption A1).
 * Throws on non-positive inputs (mirrors pixelLengthToReal validation style).
 */
export function wallAreaM2(
  points: StagePoint[],
  wallHeightMm: number,
  pixelsPerMm: number
): number {
  if (pixelsPerMm <= 0) throw new Error('pixelsPerMm must be positive')
  if (wallHeightMm <= 0) throw new Error('wallHeightMm must be positive')
  const pixelLen = polylineLength(points)
  const lengthM = pixelLen / pixelsPerMm / 1000 // px → mm → m
  const heightM = wallHeightMm / 1000
  return lengthM * heightM
}

/**
 * Returns the point exactly half-way along the arc length of the polyline.
 * Walks cumulative segment distance, interpolates inside the segment containing
 * the half-distance mark. Fixes B2 — index-based midpoint landed on an arbitrary
 * vertex; arc-length midpoint lands at the geometric center of the drawn line.
 */
export function polylineMidpointByArcLength(points: StagePoint[]): StagePoint {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return { x: points[0].x, y: points[0].y }
  const total = polylineLength(points)
  if (total === 0) return { x: points[0].x, y: points[0].y }
  const half = total / 2
  let accumulated = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const segLen = euclideanDistance(a.x, a.y, b.x, b.y)
    if (accumulated + segLen >= half) {
      const t = segLen === 0 ? 0 : (half - accumulated) / segLen
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    accumulated += segLen
  }
  // Fallback (unreachable for total > 0 but satisfies TS)
  return { x: points[points.length - 1].x, y: points[points.length - 1].y }
}
