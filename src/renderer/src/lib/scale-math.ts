import type { MeasurementUnit } from '../types/viewer'

/**
 * Human-readable labels for each supported measurement unit.
 */
export const UNIT_LABELS: Record<MeasurementUnit, string> = {
  m: 'meters',
  ft: 'feet',
  mm: 'millimeters',
  cm: 'centimeters',
  in: 'inches'
}

/**
 * Standard Euclidean distance between two 2D points.
 * Used for measuring pixel distances on a PDF page.
 */
export function euclideanDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Compute the scale ratio (pixels per real-world unit) from a calibration line.
 *
 * Throws if either input is non-positive — a zero or negative pixel distance
 * is impossible to calibrate from, and a zero/negative real-world distance is
 * physically meaningless.
 */
export function computePixelsPerUnit(
  pixelDistance: number,
  realWorldDistance: number
): number {
  if (pixelDistance <= 0) {
    throw new Error('Pixel distance must be positive')
  }
  if (realWorldDistance <= 0) {
    throw new Error('Real-world distance must be positive')
  }
  return pixelDistance / realWorldDistance
}

/**
 * Convert a measured pixel length back to a real-world distance using a
 * pre-computed pixelsPerUnit ratio.
 *
 * Throws if pixelsPerUnit is non-positive (uncalibrated or invalid scale).
 */
export function pixelsToRealWorld(
  pixelLength: number,
  pixelsPerUnit: number
): number {
  if (pixelsPerUnit <= 0) {
    throw new Error('pixelsPerUnit must be positive')
  }
  return pixelLength / pixelsPerUnit
}

/**
 * Format a scale ratio for display in the StatusBar / calibration dialog.
 * Example: formatScaleRatio(100, 'm') -> "1px = 0.0100 m"
 */
export function formatScaleRatio(
  pixelsPerUnit: number,
  unit: MeasurementUnit
): string {
  const realWorldPerPixel = 1 / pixelsPerUnit
  return `1px = ${realWorldPerPixel.toFixed(4)} ${unit}`
}
