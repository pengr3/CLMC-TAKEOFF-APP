import { Line, Text, Group } from 'react-konva'
import type { LinearMarkup as LinearMarkupType, Category } from '../../types/markup'
import type { PageScale } from '../../types/scale'
import { COLORS } from '../../lib/constants'
import { polylineLength, pixelLengthToReal, labelFontSize } from '../../lib/markup-math'

export interface LinearMarkupProps {
  markup: LinearMarkupType
  category: Category
  currentZoom: number
  pageScale: PageScale | null
}

/**
 * Renders a committed polyline with a zoom-compensated midpoint label.
 * Label format: "{name} \u2014 {value} {unit}" per D-13 / UI-SPEC Canvas Label Copy.
 * If page is uncalibrated (pageScale null), shows only the name.
 */
export function LinearMarkup({
  markup,
  category,
  currentZoom,
  pageScale
}: LinearMarkupProps): React.JSX.Element {
  const strokeWidth = 2 / currentZoom
  const fontSize = labelFontSize(currentZoom)
  const shadowBlur = 2 / currentZoom

  const flatPoints = markup.points.flatMap((p) => [p.x, p.y])
  const pixelLen = polylineLength(markup.points)

  // Midpoint of the polyline by index
  const midIndex = Math.floor(markup.points.length / 2)
  const midpoint = markup.points[midIndex] ?? markup.points[0]

  // D-13 Linear: "Name — 12.4 m" or just "Name" if uncalibrated
  let labelText = markup.name
  if (pageScale && pageScale.pixelsPerMm > 0) {
    const realLen = pixelLengthToReal(pixelLen, pageScale.pixelsPerMm, pageScale.displayUnit)
    labelText = `${markup.name} \u2014 ${realLen.toFixed(1)} ${pageScale.displayUnit}`
  }

  return (
    <Group listening={false}>
      <Line
        points={flatPoints}
        stroke={category.color}
        strokeWidth={strokeWidth}
        lineCap="round"
        lineJoin="round"
      />
      <Text
        x={midpoint.x}
        y={midpoint.y + fontSize}
        text={labelText}
        fontSize={fontSize}
        fontFamily="Inter, sans-serif"
        fontStyle="600"
        fill={COLORS.textPrimary}
        shadowColor="#ffffff"
        shadowBlur={shadowBlur}
        shadowOpacity={0.9}
        align="center"
      />
    </Group>
  )
}
