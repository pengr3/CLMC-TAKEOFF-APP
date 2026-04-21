import { Line, Text, Rect, Group } from 'react-konva'
import type { AreaMarkup as AreaMarkupType, Category } from '../../types/markup'
import type { PageScale } from '../../types/scale'
import { polygonArea, polygonCentroid, pixelAreaToReal } from '../../lib/markup-math'

export interface AreaMarkupProps {
  markup: AreaMarkupType
  category: Category   // legacy prop compat
  currentZoom: number  // legacy prop compat — not used; labels are world-anchored per D-34
  pageScale: PageScale | null
  onHoverEnter?: (id: string, screenX: number, screenY: number) => void
  onHoverLeave?: (id: string) => void
  onContextMenu?: (id: string, screenX: number, screenY: number) => void
}

// Pure world-anchored label (D-34), dark rounded chip background for legibility
// against any plan fill (D-35 fallback).
const LABEL_FONT_WORLD = 16
const LABEL_PAD_X_WORLD = 6
const LABEL_PAD_Y_WORLD = 3
const LABEL_CHIP_RADIUS_WORLD = 4
const CHAR_ADVANCE_RATIO = 0.58
const STROKE_BASE_PX = 2

/**
 * Area polygon renderer per D-24/D-31/D-34.
 * - Stroke/fill from markup.color (D-29)
 * - Label shows ONLY the area value (D-24) as a pure world-anchored chip
 * - Positioned at vertex-mean centroid
 */
export function AreaMarkup({
  markup,
  currentZoom,
  pageScale,
  onHoverEnter,
  onHoverLeave,
  onContextMenu
}: AreaMarkupProps): React.JSX.Element {
  const strokeWidth = STROKE_BASE_PX / currentZoom

  const flatPoints = markup.points.flatMap((p) => [p.x, p.y])
  const centroid = polygonCentroid(markup.points)

  let labelText = ''
  if (pageScale && pageScale.pixelsPerMm > 0) {
    const pixelArea = polygonArea(markup.points)
    const realArea = pixelAreaToReal(pixelArea, pageScale.pixelsPerMm, pageScale.displayUnit)
    labelText = `${realArea.toFixed(1)} ${pageScale.displayUnit}²`
  }

  const textWidth = labelText.length * LABEL_FONT_WORLD * CHAR_ADVANCE_RATIO
  const chipW = textWidth + LABEL_PAD_X_WORLD * 2
  const chipH = LABEL_FONT_WORLD + LABEL_PAD_Y_WORLD * 2
  const chipX = centroid.x - chipW / 2
  const chipY = centroid.y - chipH / 2

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
        closed
        stroke={markup.color}
        strokeWidth={strokeWidth}
        fill={`${markup.color}33`}
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
