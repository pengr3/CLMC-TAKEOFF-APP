/**
 * Scale types for the CLMC Takeoff App.
 *
 * Canonical representation stores scale as pixelsPerMm (pixels per millimetre),
 * with a displayUnit for human-readable formatting. This avoids unit-dependent
 * ratio calculations and keeps all math in a single unit (mm).
 */

export type ScaleUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft'

export type CalibMode = 'idle' | 'drawing' | 'confirming' | 'verifying'

export interface PageScale {
  pixelsPerMm: number
  displayUnit: ScaleUnit
}

/**
 * Millimetres per unit for each supported measurement unit.
 * Used to convert between display units and the canonical mm storage.
 */
export const MM_PER_UNIT: Record<ScaleUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8
}

export const DEFAULT_UNIT: ScaleUnit = 'm'
