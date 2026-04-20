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
  category: Category
  currentZoom: number
  pageScale: PageScale | null
}

/**
 * Renders a committed perimeter polygon with semi-transparent fill and two-line centroid label.
 * Label format (D-13): line 1 = name, line 2 = "P: {perim} {unit}  A: {area} {unit}\u00B2"
 * Fill = category.color + '33' (20% alpha) per UI-SPEC Category Color Palette.
 */
export function PerimeterMarkup({
  markup,
  category,
  currentZoom,
  pageScale
}: PerimeterMarkupProps): React.JSX.Element {
  const strokeWidth = 2 / currentZoom
  const fontSize = labelFontSize(currentZoom)
  const shadowBlur = 2 / currentZoom

  const flatPoints = markup.points.flatMap((p) => [p.x, p.y])
  const centroid = polygonCentroid(markup.points)
  const pixelArea = polygonArea(markup.points)
  // Perimeter = polylineLength of (points + first point back to close)
  const closedPoints = [...markup.points, markup.points[0]]
  const pixelPerim = polylineLength(closedPoints)

  // D-13 Perimeter: two-line — name / "P: {perim} {unit}  A: {area} {unit}\u00B2"
  const line1 = markup.name
  let line2 = ''
  if (pageScale && pageScale.pixelsPerMm > 0) {
    const realPerim = pixelLengthToReal(pixelPerim, pageScale.pixelsPerMm, pageScale.displayUnit)
    const realArea = pixelAreaToReal(pixelArea, pageScale.pixelsPerMm, pageScale.displayUnit)
    const u = pageScale.displayUnit
    line2 = `P: ${realPerim.toFixed(1)} ${u}  A: ${realArea.toFixed(1)} ${u}\u00B2`
  }

  return (
    <Group listening={false}>
      <Line
        points={flatPoints}
        closed
        stroke={category.color}
        strokeWidth={strokeWidth}
        fill={`${category.color}33`}
        lineJoin="round"
      />
      <Text
        x={centroid.x}
        y={centroid.y - fontSize}
        text={line1}
        fontSize={fontSize}
        fontFamily="Inter, sans-serif"
        fontStyle="600"
        fill={COLORS.textPrimary}
        shadowColor="#ffffff"
        shadowBlur={shadowBlur}
        shadowOpacity={0.9}
        align="center"
      />
      {line2 && (
        <Text
          x={centroid.x}
          y={centroid.y + 2 / currentZoom}
          text={line2}
          fontSize={fontSize}
          fontFamily="Inter, sans-serif"
          fontStyle="600"
          fill={COLORS.textPrimary}
          shadowColor="#ffffff"
          shadowBlur={shadowBlur}
          shadowOpacity={0.9}
          align="center"
        />
      )}
    </Group>
  )
}
