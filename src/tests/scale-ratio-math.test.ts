import { describe, it, expect } from 'vitest'
import {
  computePixelsPerMmFromRatio,
  computePixelsPerMm,
  isoSheetLabel
} from '@renderer/lib/scale-math'

describe('computePixelsPerMmFromRatio', () => {
  it('matches computePixelsPerMm for A1 page at 1:100 scale', () => {
    // A1 page: page.view widthPt ≈ 2384 pt (≈ 841 mm)
    const pageWidthPx = 1000
    const pageViewWidthPt = 2384
    const denominator = 100

    const fromRatio = computePixelsPerMmFromRatio(pageWidthPx, pageViewWidthPt, denominator)

    // Draw-line path equivalent: computePixelsPerMm(1000, pageWidthMm * 100, 'mm')
    const pageWidthMm = pageViewWidthPt * 25.4 / 72
    const fromDrawLine = computePixelsPerMm(pageWidthPx, pageWidthMm * denominator, 'mm')

    expect(fromRatio).toBeCloseTo(fromDrawLine, 10)
  })

  it('returns the correct pixelsPerMm value for A1 at 1:100', () => {
    // pageWidthMm = 2384 * 25.4 / 72 ≈ 841.067 mm
    // realWorldWidthMm = 841.067 * 100 = 84106.7 mm
    // pixelsPerMm = 1000 / 84106.7 ≈ 0.01189
    const result = computePixelsPerMmFromRatio(1000, 2384, 100)
    expect(result).toBeCloseTo(0.01189, 4)
  })

  it('throws "pageWidthPx must be positive" when pageWidthPx is 0', () => {
    expect(() => computePixelsPerMmFromRatio(0, 2384, 100)).toThrow(
      'pageWidthPx must be positive'
    )
  })

  it('throws "pageWidthPx must be positive" when pageWidthPx is negative', () => {
    expect(() => computePixelsPerMmFromRatio(-10, 2384, 100)).toThrow(
      'pageWidthPx must be positive'
    )
  })

  it('throws "pageViewWidthPt must be positive" when pageViewWidthPt is 0', () => {
    expect(() => computePixelsPerMmFromRatio(1000, 0, 100)).toThrow(
      'pageViewWidthPt must be positive'
    )
  })

  it('throws "pageViewWidthPt must be positive" when pageViewWidthPt is negative', () => {
    expect(() => computePixelsPerMmFromRatio(1000, -100, 100)).toThrow(
      'pageViewWidthPt must be positive'
    )
  })

  it('throws "denominator must be positive" when denominator is 0', () => {
    expect(() => computePixelsPerMmFromRatio(1000, 2384, 0)).toThrow(
      'denominator must be positive'
    )
  })

  it('throws "denominator must be positive" when denominator is -1', () => {
    expect(() => computePixelsPerMmFromRatio(1000, 2384, -1)).toThrow(
      'denominator must be positive'
    )
  })
})

describe('isoSheetLabel', () => {
  it('labels A1 portrait (841 × 594)', () => {
    expect(isoSheetLabel(841, 594)).toBe('841 × 594 mm — A1')
  })

  it('labels A1 landscape (594 × 841)', () => {
    expect(isoSheetLabel(594, 841)).toBe('594 × 841 mm — A1')
  })

  it('labels A0 (1189 × 841)', () => {
    expect(isoSheetLabel(1189, 841)).toBe('1189 × 841 mm — A0')
  })

  it('labels A4 (297 × 210)', () => {
    expect(isoSheetLabel(297, 210)).toBe('297 × 210 mm — A4')
  })

  it('returns raw mm for unmatched dimensions (500 × 300)', () => {
    expect(isoSheetLabel(500, 300)).toBe('500 × 300 mm')
  })

  it('matches A1 within ±5 mm tolerance (844 × 596)', () => {
    expect(isoSheetLabel(844, 596)).toBe('844 × 596 mm — A1')
  })
})
