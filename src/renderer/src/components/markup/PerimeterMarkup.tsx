import { Line, Text, Group } from 'react-konva'
import type { PerimeterMarkup as PerimeterMarkupType, Category } from '../../types/markup'
import type { PageScale } from '../../types/scale'
import { COLORS } from '../../lib/constants'
import {
  polygonArea,
  polygonCentroid,
  polylineLength,
  pixelAreaToReal,
  pixelLengthToReal,
  labelFontSize
} from '../../lib/markup-math'

export interface PerimeterMarkupProps {
  markup: PerimeterMarkupType
  category: Category   // legacy prop compat
  currentZoom: number
  pageScale: PageScale | null
  onHoverEnter?: (id: string, screenX: number, screenY: number) => void
  onHoverLeave?: (id: string) => void
  onContextMenu?: (id: string, screenX: number, screenY: number) => void
}

/**
 * Perimeter polygon renderer per D-24/D-31/D-34.
 * - Stroke/fill from markup.color (D-29)
 * - Single-line label: "P: 24.6 m  A: 38.2 m²"  (no name line, D-24)
 * - Positioned at centroid
 */
export function PerimeterMarkup({
  markup,
  currentZoom,
  pageScale,
  onHoverEnter,
  onHoverLeave,
  onContextMenu
}: PerimeterMarkupProps): React.JSX.Element {
  const strokeWidth = 2 / currentZoom
  const fontSize = labelFontSize(currentZoom)
  const shadowBlur = 2 / currentZoom

  const flatPoints = markup.points.flatMap((p) => [p.x, p.y])
  const centroid = polygonCentroid(markup.points)

  let labelText = ''
  if (pageScale && pageScale.pixelsPerMm > 0) {
    const pixelArea = polygonArea(markup.points)
    const closedPoints = [...markup.points, markup.points[0]]
    const pixelPerim = polylineLength(closedPoints)
    const realPerim = pixelLengthToReal(pixelPerim, pageScale.pixelsPerMm, pageScale.displayUnit)
    const realArea = pixelAreaToReal(pixelArea, pageScale.pixelsPerMm, pageScale.displayUnit)
    const u = pageScale.displayUnit
    labelText = `P: ${realPerim.toFixed(1)} ${u}  A: ${realArea.toFixed(1)} ${u}²`
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
