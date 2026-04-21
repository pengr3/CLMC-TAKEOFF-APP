/**
 * WCAG relative luminance + auto-contrast ink picker.
 * Supports D-23: count-pin number reads white on dark fills, black on light fills,
 * against any palette swatch.
 *
 * Threshold 0.179 corresponds to the WCAG break-point where white text on the
 * background meets 4.5:1 contrast (AA for normal text).
 */

const CONTRAST_LUMINANCE_THRESHOLD = 0.179

function normalizeHex(hex: string): string {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('')
  }
  if (h.length !== 6) throw new Error(`Invalid hex color: ${hex}`)
  return h
}

function channelLinear(channel8bit: number): number {
  const c = channel8bit / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Returns WCAG relative luminance in [0, 1] for a hex color. */
export function relativeLuminance(hex: string): number {
  const h = normalizeHex(hex)
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (
    0.2126 * channelLinear(r) +
    0.7152 * channelLinear(g) +
    0.0722 * channelLinear(b)
  )
}

/** Returns '#000000' for light fills, '#ffffff' for dark fills (D-23 auto-contrast). */
export function getContrastingInk(fillHex: string): '#000000' | '#ffffff' {
  return relativeLuminance(fillHex) > CONTRAST_LUMINANCE_THRESHOLD ? '#000000' : '#ffffff'
}
