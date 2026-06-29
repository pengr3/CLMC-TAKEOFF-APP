import { Rect, RegularPolygon } from 'react-konva'
import type { StagePoint } from '../../hooks/useCalibrationMode'
import { getContrastingInk } from '../../lib/color-utils'
import { COLORS } from '../../lib/constants'

/**
 * SnapIndicator — the single, active snap glyph rendered on the transient
 * overlay layer above committed markups (D-04, 14-UI-SPEC § "Snap indicator
 * glyphs"). Exactly one of two shapes ships this phase:
 *
 *  - □ `Rect` (axis-aligned 12px square) — vertex / endpoint / close-the-loop
 *    start vertex.
 *  - △ `RegularPolygon sides={3}` (point up, 14px circum-diameter) —
 *    nearest-point-on-segment.
 *
 * The ✕ intersection glyph is RESERVED (D-06) and is NOT shipped — no cross
 * shape is rendered anywhere in this file so the legend stays stable when
 * intersection snap lands later.
 *
 * **Zoom-compensated:** every screen-pixel constant is divided by `currentZoom`
 * so the glyph appears constant-sized at any zoom (the load-bearing overlay
 * discipline shared with HoverRing/VertexHandleOverlay).
 *
 * **Two-pass halo:** each glyph is drawn twice — a wider contrasting "halo"
 * copy first (so it reads on both light PDF paper and dark backdrop), then the
 * accent copy on top. The halo color is picked per-frame with the existing
 * `getContrastingInk()` WCAG picker (threshold 0.179) against the markup color
 * the glyph overlaps — reusing the one contrast system, never inventing a
 * second. This mirrors the crosshair-cursor "outline + foreground" two-pass
 * idea in CanvasViewport.tsx (`CROSSHAIR_CURSOR`).
 *
 * **Every shape is `listening={false}`** — the glyph marks where the click will
 * land but must never steal pointer events from the markups beneath it (same
 * rule as HoverRing/PulseHighlight).
 */

// Screen-pixel constants — divided by currentZoom in the body (D-04).
const SQUARE_PX = 12 // □ vertex glyph edge length
const TRIANGLE_PX = 14 // △ segment glyph circum-diameter
const STROKE_PX = 2 // accent stroke (foreground pass)
const HALO_STROKE_PX = 3.5 // contrasting halo (background pass)

export interface SnapIndicatorProps {
  /** The active snap target, or null → render nothing. */
  candidate: { point: StagePoint; kind: 'vertex' | 'segment' } | null
  /** Current Stage zoom; sizes/strokes are kept visually constant by dividing by this. */
  currentZoom: number
  /**
   * Color of the markup the glyph overlaps, used only to pick the halo's
   * contrasting ink. Defaults to white when no markup is underneath (e.g. the
   * glyph sits over blank PDF paper).
   */
  underlyingColor?: string
}

export function SnapIndicator({
  candidate,
  currentZoom,
  underlyingColor
}: SnapIndicatorProps): React.JSX.Element | null {
  if (candidate === null) return null

  // Zoom-compensation: every size/stroke is a screen-pixel constant / currentZoom.
  const square = SQUARE_PX / currentZoom
  const triangle = TRIANGLE_PX / currentZoom
  const stroke = STROKE_PX / currentZoom
  const haloStroke = HALO_STROKE_PX / currentZoom

  // Halo ink contrasts against whatever the glyph overlaps (markup color or
  // blank paper → white). One contrast system (color-utils.ts), not two.
  const haloColor = getContrastingInk(underlyingColor ?? '#ffffff')
  const { x, y } = candidate.point

  if (candidate.kind === 'vertex') {
    // □ axis-aligned square centered on the snapped point.
    return (
      <>
        <Rect
          x={x - square / 2}
          y={y - square / 2}
          width={square}
          height={square}
          fill="transparent"
          stroke={haloColor}
          strokeWidth={haloStroke}
          listening={false}
        />
        <Rect
          x={x - square / 2}
          y={y - square / 2}
          width={square}
          height={square}
          fill="transparent"
          stroke={COLORS.accent}
          strokeWidth={stroke}
          listening={false}
        />
      </>
    )
  }

  // △ point-up triangle centered on the snapped point. RegularPolygon's
  // `radius` is the circumradius, so a 14px circum-diameter → radius = 14/2.
  const radius = triangle / 2
  return (
    <>
      <RegularPolygon
        x={x}
        y={y}
        sides={3}
        radius={radius}
        fill="transparent"
        stroke={haloColor}
        strokeWidth={haloStroke}
        listening={false}
      />
      <RegularPolygon
        x={x}
        y={y}
        sides={3}
        radius={radius}
        fill="transparent"
        stroke={COLORS.accent}
        strokeWidth={stroke}
        listening={false}
      />
    </>
  )
}
