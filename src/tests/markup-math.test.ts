import { describe, it, expect } from 'vitest'
import {
  polylineLength,
  polygonArea,
  polygonCentroid,
  pixelLengthToReal,
  pixelAreaToReal,
  labelFontSize
} from '@renderer/lib/markup-math'

describe('polylineLength', () => {
  it('returns 0 for empty array', () => {
    expect(polylineLength([])).toBe(0)
  })

  it('returns 0 for single point', () => {
    expect(polylineLength([{ x: 0, y: 0 }])).toBe(0)
  })

  it('computes 3-4-5 single segment', () => {
    expect(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe(5)
  })

  it('sums two segments (5 + 4)', () => {
    expect(
      polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 0 }])
    ).toBe(9)
  })

  it('handles duplicate consecutive points (zero-length segment ignored by math)', () => {
    expect(
      polylineLength([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 3, y: 4 }])
    ).toBe(5)
  })
})

describe('polygonArea', () => {
  it('returns 0 for empty array', () => {
    expect(polygonArea([])).toBe(0)
  })

  it('computes area of a 10x10 square (CCW)', () => {
    expect(
      polygonArea([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ])
    ).toBe(100)
  })

  it('computes area of right triangle (4x3/2 = 6)', () => {
    expect(
      polygonArea([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }])
    ).toBe(6)
  })

  it('CW points return same positive value as CCW (Math.abs applied)', () => {
    const ccw = polygonArea([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ])
    const cw = polygonArea([
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 0 }
    ])
    expect(cw).toBe(ccw)
  })
})

describe('polygonCentroid', () => {
  it('returns origin for empty array', () => {
    expect(polygonCentroid([])).toEqual({ x: 0, y: 0 })
  })

  it('returns the only point for single-point array', () => {
    expect(polygonCentroid([{ x: 0, y: 0 }])).toEqual({ x: 0, y: 0 })
  })

  it('returns center of a 10x10 square', () => {
    expect(
      polygonCentroid([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ])
    ).toEqual({ x: 5, y: 5 })
  })
})

describe('pixelLengthToReal', () => {
  it('converts 10000 px at 10 px/mm to 1 m', () => {
    expect(pixelLengthToReal(10000, 10, 'm')).toBe(1)
  })

  it('converts 100 px at 1 px/mm to 100 mm', () => {
    expect(pixelLengthToReal(100, 1, 'mm')).toBe(100)
  })
})

describe('pixelAreaToReal', () => {
  it('converts 10000x10000 px² at 10 px/mm to 1 m² (MARK-03 area scaling)', () => {
    expect(pixelAreaToReal(10000 * 10000, 10, 'm')).toBe(1)
  })

  it('10mm x 10mm square at pixelsPerMm=10 reports 100 mm² (MARK-03 area scaling)', () => {
    // 10mm * 10px/mm = 100px per side -> 100*100 = 10000 px²
    expect(pixelAreaToReal(100 * 100, 10, 'mm')).toBe(100)
  })

  it('converts pixel area to ft² using MM_PER_UNIT.ft quadratic ratio', () => {
    // 1 ft = 304.8 mm. At 1 px/mm: 304.8 px = 1 ft. So 304.8^2 px² = 1 ft²
    const ft2 = pixelAreaToReal(304.8 * 304.8, 1, 'ft')
    expect(ft2).toBeCloseTo(1, 10)
  })
})

describe('labelFontSize (LABEL_FONT_BASE=14 per D-34)', () => {
  it('returns 14 at zoom 1', () => {
    expect(labelFontSize(1)).toBe(14)
  })

  it('returns 10 at zoom 2 (14/2=7, floor to 10)', () => {
    expect(labelFontSize(2)).toBe(10)
  })

  it('returns 56 at zoom 0.25 (14/0.25=56)', () => {
    expect(labelFontSize(0.25)).toBe(56)
  })

  it('returns 10 at zoom 4 (14/4=3.5, floor to 10)', () => {
    expect(labelFontSize(4)).toBe(10)
  })

  it('always returns value >= 10 (floor guarantee)', () => {
    for (const zoom of [1, 2, 3, 4, 5, 10, 100]) {
      expect(labelFontSize(zoom)).toBeGreaterThanOrEqual(10)
    }
  })
})
