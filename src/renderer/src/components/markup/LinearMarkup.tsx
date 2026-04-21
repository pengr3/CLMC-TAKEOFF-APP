import { Line, Text, Rect, Group } from 'react-konva'
import type { LinearMarkup as LinearMarkupType, Category } from '../../types/markup'
import type { PageScale } from '../../types/scale'
import {
  polylineLength,
  pixelLengthToReal,
  polylineMidpointByArcLength
} from '../../lib/markup-math'

export interface LinearMarkupProps {
  markup: LinearMarkupType
  category: Category   // legacy prop compat
  currentZoom: number  // legacy prop compat — not used; labels are world-anchored per D-34
  pageScale: PageScale | null
  onHoverEnter?: (id: string, screenX: number, screenY: number) => void
  onHoverLeave?: (id: string) => void
  onContextMenu?: (id: string, screenX: number, screenY: number) => void
}

// Pure world-anchored label sizing — labels behave like count pins (D-22/D-34):
// they're stamps on the drawing, scaling with zoom. No screen-size clamps, no
// `/ currentZoom` division. Dark rounded chip behind white text for legibility
// against any plan background (D-35 fallback).
const LABEL_FONT_WORLD = 16
const LABEL_PAD_X_WORLD = 6
const LABEL_PAD_Y_WORLD = 3
const LABEL_CHIP_RADIUS_WORLD = 4
// Rough advance width for Inter 600 — used to estimate chip width without
// measuring the rendered glyph bounds. Slight over-estimate is fine; it just
// pads the chip.
const CHAR_ADVANCE_RATIO = 0.58
// Stroke stays zoom-compensated so lines remain visible at fit zoom.
const STROKE_BASE_PX = 2

/**
 * Linear polyline renderer per D-24/D-31/D-34 + B2 fix.
 * - Stroke color from markup.color (D-29)
 * - Label shows ONLY the measurement (no name, D-24)
 * - Label positioned at true arc-length midpoint (B2 fix)
 * - Label pure world-anchored with dark chip background (D-34 + D-35 fallback)
 * - Uncalibrated page: no measurement label rendered
 */
export function LinearMarkup({
  markup,
  currentZoom,
  pageScale,
  onHoverEnter,
  onHoverLeave,
  onContextMenu
}: LinearMarkupProps): React.JSX.Element {
  const strokeWidth = STROKE_BASE_PX / currentZoom

  const flatPoints = markup.points.flatMap((p) => [p.x, p.y])

  const midpoint = polylineMidpointByArcLength(markup.points)

  let labelText = ''
  if (pageScale && pageScale.pixelsPerMm > 0) {
    const pixelLen = polylineLength(markup.points)
    const realLen = pixelLengthToReal(pixelLen, pageScale.pixelsPerMm, pageScale.displayUnit)
    labelText = `${realLen.toFixed(1)} ${pageScale.displayUnit}`
  }

  const textWidth = labelText.length * LABEL_FONT_WORLD * CHAR_ADVANCE_RATIO
  const chipW = textWidth + LABEL_PAD_X_WORLD * 2
  const chipH = LABEL_FONT_WORLD + LABEL_PAD_Y_WORLD * 2
  // Sit the label below the line midpoint with a small gap.
  const chipX = midpoint.x - chipW / 2
  const chipY = midpoint.y + LABEL_FONT_WORLD * 0.6

  return (
    <Group
      onMouseEnter={(e) => {
        const stage = e.target.getStage()
        const p = stage?.getPointerPosition()
        if (p && onHoverEnter) onHoverEnter(markup.id, p.x, p.y)
      }}
      onMouseLeave={() => onHoverLeave?.(markup.id)}
      onContextMenu={(e) => {
        e.evt.preventDefault()
        const stage = e.target.getStage()
        const p = stage?.getPointerPosition()
        if (p && onContextMenu) onContextMenu(markup.id, p.x, p.y)
      }}
    >
      <Line
        points={flatPoints}
        stroke={markup.color}
        strokeWidth={strokeWidth}
        lineCap="round"
        lineJoin="round"
      />
      {labelText && (
        <>
          <Rect
            x={chipX}
            y={chipY}
            width={chipW}
            height={chipH}
            cornerRadius={LABEL_CHIP_RADIUS_WORLD}
            fill="rgba(20, 20, 20, 0.78)"
            listening={false}
          />
          <Text
            x={chipX}
            y={chipY + LABEL_PAD_Y_WORLD}
            width={chipW}
            text={labelText}
            fontSize={LABEL_FONT_WORLD}
            fontFamily="Inter, sans-serif"
            fontStyle="700"
            fill="#ffffff"
            align="center"
            listening={false}
          />
        </>
      )}
    </Group>
  )
}
