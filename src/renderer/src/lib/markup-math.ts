import type { StagePoint } from '../hooks/useCalibrationMode'
import type { ScaleUnit } from '../types/scale'
import { MM_PER_UNIT } from '../types/scale'
import { euclideanDistance, fromMm } from './scale-math'
import { LABEL_FONT_BASE, LABEL_FONT_FLOOR } from '../types/markup'

export function polylineLength(points: StagePoint[]): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += euclideanDistance(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y)
  }
  return total
}

export function polygonArea(points: StagePoint[]): number {
  if (points.length < 3) return 0
  let area = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  return Math.abs(area) / 2
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
