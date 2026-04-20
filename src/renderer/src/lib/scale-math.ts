import type { MeasurementUnit } from '../types/viewer'
import type { ScaleUnit } from '../types/scale'
import { MM_PER_UNIT } from '../types/scale'

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
 * Minimum pixel distance required for a valid calibration line.
 * Lines shorter than this are rejected as too imprecise.
 */
export const MIN_CALIBRATION_PIXELS = 10

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
 * Compute the Euclidean pixel length between two stage points.
 */
export function pixelLength(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return euclideanDistance(a.x, a.y, b.x, b.y)
}

/**
 * Convert a value in a given unit to millimetres.
 */
export function toMm(value: number, unit: ScaleUnit): number {
  return value * MM_PER_UNIT[unit]
}

/**
 * Convert millimetres to the given unit.
 */
export function fromMm(mm: number, unit: ScaleUnit): number {
  return mm / MM_PER_UNIT[unit]
}

// ─── OLD API (kept for backward compatibility with useCalibration / CalibrationDialog) ─────────────

/**
 * Compute the scale ratio (pixels per real-world unit) from a calibration line.
 *
 * Throws if either input is non-positive — a zero or negative pixel distance
 * is impossible to calibrate from, and a zero/negative real-world distance is
 * physically meaningless.
 *
 * @deprecated Use computePixelsPerMm instead for new code.
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
 *
 * Overload: if pixelsPerMm and optional unit are provided, uses the new API.
 */
export function pixelsToRealWorld(
  pixelLength: number,
  pixelsPerUnitOrMm: number,
  unit?: ScaleUnit
): number {
  if (pixelsPerUnitOrMm <= 0) {
    throw new Error('pixelsPerUnit must be positive')
  }
  if (unit !== undefined) {
    // New API: pixelsPerMm provided; convert result to displayUnit
    const realWorldMm = pixelLength / pixelsPerUnitOrMm
    return fromMm(realWorldMm, unit)
  }
  // Old API: direct division
  return pixelLength / pixelsPerUnitOrMm
}

/**
 * Format a scale ratio for display in the StatusBar / calibration dialog.
 *
 * New single-arg form: formatScaleRatio(pixelsPerMm) -> "1:N"
 * where N = round(1 / pixelsPerMm) (mm per pixel -> 1:N drawing scale).
 *
 * Old two-arg form kept for backward compatibility:
 * formatScaleRatio(pixelsPerUnit, unit) -> "1px = X.XXXX unit"
 */
export function formatScaleRatio(pixelsPerMmOrUnit: number, unit?: MeasurementUnit): string {
  if (unit !== undefined) {
    // Old API: "1px = X.XXXX unit"
    const realWorldPerPixel = 1 / pixelsPerMmOrUnit
    return `1px = ${realWorldPerPixel.toFixed(4)} ${unit}`
  }
  // New API: "1:N" ratio
  // pixelsPerMm = pixels per mm. So 1 pixel = (1/pixelsPerMm) mm.
  // Drawing scale 1:N means 1 drawing unit = N real units.
  // N = mm per pixel = 1 / pixelsPerMm
  const mmPerPixel = 1 / pixelsPerMmOrUnit
  return `1:${Math.round(mmPerPixel)}`
}

// ─── NEW API (mm-based canonical scale) ─────────────────────────────────────

/**
 * Compute the canonical scale ratio (pixels per millimetre) from a calibration line.
 *
 * The line has a pixel length (linePixelLength) representing realWorldDistance
 * in the given unit. All scale storage uses pixelsPerMm as the canonical field.
 *
 * Throws if either input is non-positive.
 */
export function computePixelsPerMm(
  linePixelLength: number,
  realWorldDistance: number,
  unit: ScaleUnit
): number {
  if (linePixelLength <= 0) {
    throw new Error('Pixel distance must be positive')
  }
  if (realWorldDistance <= 0) {
    throw new Error('Real-world distance must be positive')
  }
  const realWorldMm = toMm(realWorldDistance, unit)
  return linePixelLength / realWorldMm
}
