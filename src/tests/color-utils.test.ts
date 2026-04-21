import { describe, it, expect } from 'vitest'
import { relativeLuminance, getContrastingInk } from '@renderer/lib/color-utils'
import { MARKUP_PALETTE } from '@renderer/lib/markup-palette'

describe('relativeLuminance', () => {
  it('pure black has luminance 0', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
  })

  it('pure white has luminance 1', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
  })

  it('accepts 3-char hex shorthand', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5)
  })

  it('throws on malformed hex', () => {
    expect(() => relativeLuminance('notacolor')).toThrow()
  })
})

describe('getContrastingInk', () => {
  it('returns black on bright yellow', () => {
    expect(getContrastingInk('#ffff00')).toBe('#000000')
  })

  it('returns white on dark blue', () => {
    expect(getContrastingInk('#00008b')).toBe('#ffffff')
  })

  it('returns black on pure white (edge)', () => {
    expect(getContrastingInk('#ffffff')).toBe('#000000')
  })

  it('returns white on pure black (edge)', () => {
    expect(getContrastingInk('#000000')).toBe('#ffffff')
  })

  it('every MARKUP_PALETTE swatch receives a deterministic ink choice', () => {
    for (const swatch of MARKUP_PALETTE) {
      const ink = getContrastingInk(swatch)
      expect(ink === '#000000' || ink === '#ffffff').toBe(true)
    }
  })

  it('D-23 - amber and lime use black ink; blue/violet/slate use white ink', () => {
    expect(getContrastingInk('#ca8a04')).toBe('#000000')  // amber
    expect(getContrastingInk('#65a30d')).toBe('#000000')  // lime
    expect(getContrastingInk('#2563eb')).toBe('#ffffff')  // blue
    expect(getContrastingInk('#7c3aed')).toBe('#ffffff')  // violet
    expect(getContrastingInk('#475569')).toBe('#ffffff')  // slate
  })
})
