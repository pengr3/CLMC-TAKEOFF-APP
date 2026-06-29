import { Line, Text, Rect, Group } from 'react-konva'
import type { AreaMarkup as AreaMarkupType, Category } from '../../types/markup'
import type { PageScale } from '../../types/scale'
import type { StagePoint } from '../../hooks/useCalibrationMode'
import { polygonArea, polygonCentroid, pixelAreaToReal } from '../../lib/markup-math'
import { buildArcAwareFlatPoints } from '../../lib/arc-math'
import { useProjectStore } from '../../stores/projectStore'

export interface AreaMarkupProps {
  markup: AreaMarkupType
  category: Category   // legacy prop compat
  currentZoom: number  // legacy prop compat — not used; labels are world-anchored per D-34
  pageScale: PageScale | null
  onHoverEnter?: (id: string, screenX: number, screenY: number) => void
  onHoverLeave?: (id: string) => void
  onContextMenu?: (id: string, screenX: number, screenY: number) => void
  /** Plan 09-02: single-click selection. D-03 guard lives in CanvasViewport. */
  onClick?: (id: string) => void
  /** Called on mousedown on the markup body (Group), forwarding the markup id.
   *  CanvasViewport reads this ref to start body-drag before the Stage-level handler fires. */
  onMarkupMouseDown?: (id: string) => void
  /** When set, render these points instead of markup.points (live drag preview). */
  overridePoints?: StagePoint[]
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
 *
 * Visibility key: composite `name|categoryId` so that items sharing a name
 * in different categories are hidden/shown independently.
 */
export function AreaMarkup({
  markup,
  currentZoom,
  pageScale,
  onHoverEnter,
  onHoverLeave,
  onContextMenu,
  onClick,
  onMarkupMouseDown,
  overridePoints
}: AreaMarkupProps): React.JSX.Element | null {
  // Composite key: "name|categoryId" — matches the key used by TotalsRow toggleHiddenItem.
  const itemKey = `${markup.name}|${markup.categoryId ?? ''}`
  const isHidden = useProjectStore((s) => s.hiddenItemSet.has(itemKey))
  if (isHidden) return null

  // Live drag preview: render overridePoints when supplied, otherwise persistent geometry.
  const effectivePoints = overridePoints ?? markup.points

  const strokeWidth = STROKE_BASE_PX / currentZoom

  // Arc-aware boundary: sample the true arc for any edge (incl. the closing
  // edge n-1→0) that has an arcs entry, so the drawn polygon matches the
  // arc-corrected BOQ area. During a live drag preview the arcs map no longer
  // aligns with the moved points → fall back to straight chords.
  const flatPoints = buildArcAwareFlatPoints(
    effectivePoints,
    overridePoints ? undefined : markup.arcs,
    true
  )
  const centroid = polygonCentroid(effectivePoints)

  let labelText = ''
  if (pageScale && pageScale.pixelsPerMm > 0) {
    const pixelArea = polygonArea(effectivePoints, overridePoints ? undefined : markup.arcs)
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
      onClick={() => onClick?.(markup.id)}
      onMouseDown={() => onMarkupMouseDown?.(markup.id)}
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
