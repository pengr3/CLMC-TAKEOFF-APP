/**
 * 10-swatch markup color palette — per D-26 (preset palette only, 8-12 swatches).
 *
 * Selection rationale:
 *  - WCAG AA contrast against BOTH white and black for auto-contrast (D-23).
 *    Every swatch has relative luminance that lands on a side of the 0.179 threshold
 *    (WCAG relative luminance break-point where white text on the color meets 4.5:1).
 *  - Hues spaced ~36 degrees apart on the wheel so adjacent colors never collide visually.
 *  - Sourced from Tailwind 600-level hues — battle-tested for web UI accessibility.
 *
 * These are the ONLY colors available in MarkupNamePopup picker (D-26).
 */
export const MARKUP_PALETTE = [
  '#dc2626', // red-600
  '#ea580c', // orange-600
  '#ca8a04', // amber-600
  '#65a30d', // lime-600
  '#16a34a', // green-600
  '#0891b2', // cyan-600
  '#2563eb', // blue-600
  '#7c3aed', // violet-600
  '#db2777', // pink-600
  '#475569'  // slate-600
] as const

export type PaletteColor = typeof MARKUP_PALETTE[number]

/**
 * Pick the next palette color not present in `usedColors`.
 * Wraps to index 0 if every palette entry is already in use (matches CATEGORY_PALETTE cycling).
 */
export function nextPaletteColor(usedColors: readonly string[]): string {
  for (const swatch of MARKUP_PALETTE) {
    if (!usedColors.includes(swatch)) return swatch
  }
  return MARKUP_PALETTE[0]
}
