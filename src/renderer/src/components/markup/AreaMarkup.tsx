import { Line, Text, Group } from 'react-konva'
import type { AreaMarkup as AreaMarkupType, Category } from '../../types/markup'
import type { PageScale } from '../../types/scale'
import { COLORS } from '../../lib/constants'
import {
  polygonArea,
  polygonCentroid,
  pixelAreaToReal,
  labelFontSize
} from '../../lib/markup-math'

export interface AreaMarkupProps {
  markup: AreaMarkupType
  category: Category   // legacy prop compat
  currentZoom: number
  pageScale: PageScale | null
  onHoverEnter?: (id: string, screenX: number, screenY: number) => void
  onHoverLeave?: (id: string) => void
  onContextMenu?: (id: string, screenX: number, screenY: number) => void
}

/**
 * Area polygon renderer per D-24/D-31/D-34.
 * - Stroke/fill from markup.color (D-29)
 * - Label shows ONLY the area value (no name line, D-24)
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
  const strokeWidth = 2 / currentZoom
  const fontSize = labelFontSize(currentZoom)
  const shadowBlur = 2 / currentZoom

  const flatPoints = markup.points.flatMap((p) => [p.x, p.y])
  const centroid = polygonCentroid(markup.points)

  let labelText = ''
  if (pageScale && pageScale.pixelsPerMm > 0) {
    const pixelArea = polygonArea(markup.points)
    const realArea = pixelAreaToReal(pixelArea, pageScale.pixelsPerMm, pageScale.displayUnit)
    labelText = `${realArea.toFixed(1)} ${pageScale.displayUnit}²`
  }

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
        <Text
          x={centroid.x}
          y={centroid.y - fontSize / 2}
          text={labelText}
          fontSize={fontSize}
          fontFamily="Inter, sans-serif"
          fontStyle="600"
          fill={COLORS.textPrimary}
          shadowColor="#ffffff"
          shadowBlur={shadowBlur}
          shadowOpacity={0.9}
          align="center"
          listening={false}
        />
      )}
    </Group>
  )
}
