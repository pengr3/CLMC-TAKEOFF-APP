import { Circle, Text, Group } from 'react-konva'
import type { CountMarkup, Category } from '../../types/markup'
import { COLORS } from '../../lib/constants'
import { labelFontSize } from '../../lib/markup-math'

export interface CountPinMarkupProps {
  markup: CountMarkup
  category: Category
  currentZoom: number
}

/**
 * Renders a single count pin as a colored circle with a zoom-compensated label.
 * Label format: "{name} {sequence}" per D-04 / D-13.
 */
export function CountPinMarkup({
  markup,
  category,
  currentZoom
}: CountPinMarkupProps): React.JSX.Element {
  const pinRadius = 6 / currentZoom
  const strokeWidth = 1 / currentZoom
  const fontSize = labelFontSize(currentZoom)
  const labelOffsetX = 10 / currentZoom
  const shadowBlur = 2 / currentZoom

  // D-04 / D-13: label reads "Name N" (dot is the pin itself)
  const labelText = `${markup.name} ${markup.sequence}`

  return (
    <Group listening={false}>
      <Circle
        x={markup.point.x}
        y={markup.point.y}
        radius={pinRadius}
        fill={category.color}
        stroke="#ffffff"
        strokeWidth={strokeWidth}
      />
      <Text
        x={markup.point.x + labelOffsetX}
        y={markup.point.y - fontSize / 2}
        text={labelText}
        fontSize={fontSize}
        fontFamily="Inter, sans-serif"
        fontStyle="600"
        fill={COLORS.textPrimary}
        shadowColor="#ffffff"
        shadowBlur={shadowBlur}
        shadowOpacity={0.9}
      />
    </Group>
  )
}
