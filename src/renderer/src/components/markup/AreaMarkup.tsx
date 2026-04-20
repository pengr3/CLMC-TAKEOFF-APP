import { Line, Text, Group } from 'react-konva'
import type { AreaMarkup as AreaMarkupType, Category } from '../../types/markup'
import type { PageScale } from '../../types/scale'
import { COLORS } from '../../lib/constants'
import { polygonArea, polygonCentroid, pixelAreaToReal, labelFontSize } from '../../lib/markup-math'

export interface AreaMarkupProps {
  markup: AreaMarkupType
  category: Category
  currentZoom: number
  pageScale: PageScale | null
}

/**
 * Renders a committed area polygon with semi-transparent fill and two-line centroid label.
 * Label format (D-13): line 1 = name, line 2 = "{value} {unit}\u00B2"
 * Fill = category.color + '33' (20% alpha) per UI-SPEC Category Color Palette.
 */
export function AreaMarkup({
  markup,
  category,
  currentZoom,
  pageScale
}: AreaMarkupProps): React.JSX.Element {
  const strokeWidth = 2 / currentZoom
  const fontSize = labelFontSize(currentZoom)
  const shadowBlur = 2 / currentZoom

  const flatPoints = markup.points.flatMap((p) => [p.x, p.y])
  const centroid = polygonCentroid(markup.points)
  const pixelArea = polygonArea(markup.points)

  // D-13 Area: two-line — name / "{value} {unit}\u00B2"
  const line1 = markup.name
  let line2 = ''
  if (pageScale && pageScale.pixelsPerMm > 0) {
    const realArea = pixelAreaToReal(pixelArea, pageScale.pixelsPerMm, pageScale.displayUnit)
    line2 = `${realArea.toFixed(1)} ${pageScale.displayUnit}\u00B2`
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
