import { Circle, Text, Group } from 'react-konva'
import type { CountMarkup, Category } from '../../types/markup'
import { getContrastingInk } from '../../lib/color-utils'

export interface CountPinMarkupProps {
  markup: CountMarkup
  /** Legacy prop - kept for caller compatibility; color is read from markup.color (D-29). */
  category: Category
  /** Not used by the pin body anymore (D-22 pure world-anchored) - accepted for prop compat. */
  currentZoom: number
  onHoverEnter?: (id: string, screenX: number, screenY: number) => void
  onHoverLeave?: (id: string) => void
  onContextMenu?: (id: string, screenX: number, screenY: number) => void
}

// D-22: pins are "stamps on the plan" - pure world-anchored.
// No division by currentZoom. Accepted trade-off: tiny at fit zoom, large at 8x zoom.
const PIN_RADIUS_WORLD = 10
const PIN_STROKE_WORLD = 1.25
const NUMBER_FONT_WORLD = 12

/**
 * Count pin per D-21/D-22/D-23:
 *  - Colored circle using markup.color per D-29
 *  - Sequence number rendered INSIDE the circle
 *  - Pure world-anchored size (no zoom compensation) - stamps on the drawing
 *  - Auto-contrast ink (white on dark fills, black on light fills)
 *  - Name is never on canvas (D-24) - it appears only in the hover tooltip
 *    rendered by CanvasViewport.
 */
export function CountPinMarkup({
  markup,
  onHoverEnter,
  onHoverLeave,
  onContextMenu
}: CountPinMarkupProps): React.JSX.Element {
  const fill = markup.color
  const ink = getContrastingInk(fill)
  const label = String(markup.sequence)

  // Center the text inside the circle: width = 2*radius; align center.
  // y offset so text baseline sits on the circle center.
  const boxW = PIN_RADIUS_WORLD * 2

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
      <Circle
        x={markup.point.x}
        y={markup.point.y}
        radius={PIN_RADIUS_WORLD}
        fill={fill}
        stroke="#ffffff"
        strokeWidth={PIN_STROKE_WORLD}
      />
      <Text
        x={markup.point.x - PIN_RADIUS_WORLD}
        y={markup.point.y - NUMBER_FONT_WORLD / 2}
        width={boxW}
        text={label}
        fontSize={NUMBER_FONT_WORLD}
        fontFamily="Inter, sans-serif"
        fontStyle="700"
        fill={ink}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  )
}
