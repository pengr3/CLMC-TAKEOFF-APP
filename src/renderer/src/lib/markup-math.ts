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
