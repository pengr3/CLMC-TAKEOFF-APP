import { describe, it, expect } from 'vitest'
import {
  euclideanDistance,
  computePixelsPerUnit,
  pixelsToRealWorld,
  formatScaleRatio,
  UNIT_LABELS
} from '@renderer/lib/scale-math'

describe('scale-math', () => {
  describe('euclideanDistance', () => {
    it('computes a 3-4-5 triangle hypotenuse', () => {
      expect(euclideanDistance(0, 0, 3, 4)).toBe(5)
    })

    it('returns 0 for identical points', () => {
      expect(euclideanDistance(0, 0, 0, 0)).toBe(0)
    })

    it('handles offset 3-4-5 triangle', () => {
      expect(euclideanDistance(1, 1, 4, 5)).toBe(5)
    })

    it('is symmetric', () => {
      expect(euclideanDistance(2, 7, 9, 3)).toBeCloseTo(
        euclideanDistance(9, 3, 2, 7),
        10
      )
    })

    it('handles negative coordinates', () => {
      expect(euclideanDistance(-3, -4, 0, 0)).toBe(5)
    })
  })

  describe('computePixelsPerUnit', () => {
    it('computes ratio from pixel distance and real-world distance', () => {
      expect(computePixelsPerUnit(500, 5)).toBe(100)
    })

    it('handles fractional results', () => {
      expect(computePixelsPerUnit(250, 4)).toBe(62.5)
    })

    it('throws when pixel distance is zero', () => {
      expect(() => computePixelsPerUnit(0, 5)).toThrow(
        'Pixel distance must be positive'
      )
    })

    it('throws when pixel distance is negative', () => {
      expect(() => computePixelsPerUnit(-10, 5)).toThrow(
        'Pixel distance must be positive'
      )
    })

    it('throws when real-world distance is zero', () => {
      expect(() => computePixelsPerUnit(500, 0)).toThrow(
        'Real-world distance must be positive'
      )
    })

    it('throws when real-world distance is negative', () => {
      expect(() => computePixelsPerUnit(500, -1)).toThrow(
        'Real-world distance must be positive'
      )
    })
  })

  describe('pixelsToRealWorld', () => {
    it('converts pixel length to real-world distance', () => {
      expect(pixelsToRealWorld(300, 100)).toBe(3)
    })

    it('returns 0 for zero pixel length', () => {
      expect(pixelsToRealWorld(0, 100)).toBe(0)
    })

    it('throws when pixelsPerUnit is zero', () => {
      expect(() => pixelsToRealWorld(100, 0)).toThrow(
        'pixelsPerUnit must be positive'
      )
    })

    it('throws when pixelsPerUnit is negative', () => {
      expect(() => pixelsToRealWorld(100, -50)).toThrow(
        'pixelsPerUnit must be positive'
      )
    })

    it('round-trips with computePixelsPerUnit', () => {
      const ppu = computePixelsPerUnit(500, 5)
      expect(pixelsToRealWorld(500, ppu)).toBeCloseTo(5, 10)
    })
  })

  describe('formatScaleRatio', () => {
    it('formats meters with 4 decimals', () => {
      const result = formatScaleRatio(100, 'm')
      expect(result).toContain('0.0100')
      expect(result).toContain('m')
    })

    it('formats feet with 4 decimals', () => {
      const result = formatScaleRatio(1, 'ft')
      expect(result).toContain('1.0000')
      expect(result).toContain('ft')
    })

    it('uses 1px = X unit shape', () => {
      expect(formatScaleRatio(50, 'mm')).toMatch(/^1px = /)
    })
  })

  describe('UNIT_LABELS', () => {
    it('maps meters', () => {
      expect(UNIT_LABELS['m']).toBe('meters')
    })

    it('maps feet', () => {
      expect(UNIT_LABELS['ft']).toBe('feet')
    })

    it('maps millimeters', () => {
      expect(UNIT_LABELS['mm']).toBe('millimeters')
    })

    it('maps centimeters', () => {
      expect(UNIT_LABELS['cm']).toBe('centimeters')
    })

    it('maps inches', () => {
      expect(UNIT_LABELS['in']).toBe('inches')
    })
  })
})
