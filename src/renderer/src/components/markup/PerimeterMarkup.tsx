import { Line, Text, Rect, Group } from 'react-konva'
import type { PerimeterMarkup as PerimeterMarkupType, Category } from '../../types/markup'
import type { PageScale } from '../../types/scale'
import type { StagePoint } from '../../hooks/useCalibrationMode'
import {
  polygonCentroid,
  polylineLength,
  pixelLengthToReal
} from '../../lib/markup-math'
import { buildArcAwareFlatPoints } from '../../lib/arc-math'
import { useProjectStore } from '../../stores/projectStore'

export interface PerimeterMarkupProps {
  markup: PerimeterMarkupType
  category: Category   // legacy prop compat
  currentZoom: number  // used to keep strokeWidth visually constant across zoom levels (STROKE_BASE_PX / currentZoom); labels are world-anchored per D-34
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
 * Perimeter polygon renderer per D-24/D-31/D-34.
 * - UNFILLED closed outline; stroke from markup.color (D-29). Since Phase 15 the
 *   perimeter is a length-only measurement, so there is no translucent fill.
 * - Single-line label: "P: 24.6 m"  (length only, no area, no name — D-24)
 * - Label pure world-anchored with dark chip background
 * - Positioned at centroid
 *
 * Length stays arc-aware (Phase 14): the closing-augmented polyline length is
 * computed over arc-flattened points so curved edges measure correctly.
 *
 * Visibility key: composite `name|categoryId` so that items sharing a name
 * in different categories are hidden/shown independently.
 */
export function PerimeterMarkup({
  markup,
  currentZoom,
  pageScale,
  onHoverEnter,
  onHoverLeave,
  onContextMenu,
  onClick,
  onMarkupMouseDown,
  overridePoints
}: PerimeterMarkupProps): React.JSX.Element | null {
  // Composite key: "name|categoryId" — matches the key used by TotalsRow toggleHiddenItem.
  const itemKey = `${markup.name}|${markup.categoryId ?? ''}`
  const isHidden = useProjectStore((s) => s.hiddenItemSet.has(itemKey))
  if (isHidden) return null

  // Live drag preview: render overridePoints when supplied, otherwise persistent geometry.
  const effectivePoints = overridePoints ?? markup.points

  const strokeWidth = STROKE_BASE_PX / currentZoom

  // Arc-aware boundary (incl. the closing edge) — matches the arc-corrected
  // perimeter LENGTH in the label and BOQ. Live drag preview falls back to
  // straight chords (the arcs map no longer aligns with the moved points).
  const effectiveArcs = overridePoints ? undefined : markup.arcs
  const flatPoints = buildArcAwareFlatPoints(effectivePoints, effectiveArcs, true)
  const centroid = polygonCentroid(effectivePoints)

  let labelText = ''
  if (pageScale && pageScale.pixelsPerMm > 0) {
    // Arc-aware closing-augmented perimeter length (Phase 14 — do not regress).
    const closedPoints = [...effectivePoints, effectivePoints[0]]
    const pixelPerim = polylineLength(closedPoints, effectiveArcs)
    const realPerim = pixelLengthToReal(pixelPerim, pageScale.pixelsPerMm, pageScale.displayUnit)
    const u = pageScale.displayUnit
    labelText = `P: ${realPerim.toFixed(1)} ${u}`
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
