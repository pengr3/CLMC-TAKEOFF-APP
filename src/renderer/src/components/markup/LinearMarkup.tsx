import { Line, Text, Group } from 'react-konva'
import type { LinearMarkup as LinearMarkupType, Category } from '../../types/markup'
import type { PageScale } from '../../types/scale'
import { COLORS } from '../../lib/constants'
import {
  polylineLength,
  pixelLengthToReal,
  labelFontSize,
  polylineMidpointByArcLength
} from '../../lib/markup-math'

export interface LinearMarkupProps {
  markup: LinearMarkupType
  category: Category   // legacy prop compat
  currentZoom: number
  pageScale: PageScale | null
}

/**
 * Linear polyline renderer per D-24/D-31/D-34 + B2 fix.
 * - Stroke color from markup.color (D-29), not from the legacy category field
 * - Label shows ONLY the measurement (no name, D-24)
 * - Label positioned at true arc-length midpoint (B2 fix - NOT index midpoint)
 * - Uncalibrated page: no measurement label rendered
 * - Font 14px world base, still zoom-compensated (D-34 applies to labels,
 *   D-22 carve-out for pins only)
 */
export function LinearMarkup({
  markup,
  currentZoom,
  pageScale
}: LinearMarkupProps): React.JSX.Element {
  const strokeWidth = 2 / currentZoom
  const fontSize = labelFontSize(currentZoom)
  const shadowBlur = 2 / currentZoom

  const flatPoints = markup.points.flatMap((p) => [p.x, p.y])

  // B2 fix: arc-length midpoint, not index midpoint
  const midpoint = polylineMidpointByArcLength(markup.points)

  let labelText = ''
  if (pageScale && pageScale.pixelsPerMm > 0) {
    const pixelLen = polylineLength(markup.points)
    const realLen = pixelLengthToReal(pixelLen, pageScale.pixelsPerMm, pageScale.displayUnit)
    labelText = `${realLen.toFixed(1)} ${pageScale.displayUnit}`
  }

  return (
    <Group>
      <Line
        points={flatPoints}
        stroke={markup.color}
        strokeWidth={strokeWidth}
        lineCap="round"
        lineJoin="round"
      />
      {labelText && (
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
          listening={false}
        />
      )}
    </Group>
  )
}
