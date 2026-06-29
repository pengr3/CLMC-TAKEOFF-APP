/**
 * Wall polyline renderer per D-10 / RESEARCH §Feature 2.
 *
 * Visual affordance: primary stroke at 2.5× base width (WALL_STROKE_MULTIPLIER)
 * with a parallel offset hairline at 70% opacity (WALL_HAIRLINE_OPACITY) to
 * visually distinguish a wall from a plain linear. The hairline uses Konva's
 * `offsetY` to shift the rendered path, which is an acceptable approximation
 * for dense plans. True miter-corner offset is deferred (see CONTEXT.md
 * "Wall thickness rendering").
 *
 * Budget escape hatch: if the hairline produces artifacts on dense plans,
 * delete the second Konva Line (hairline) in the Group to fall back to
 * 2.5× stroke alone — this is the RESEARCH-documented fallback.
 *
 * Label shows m² wall area (length × height) at the arc-length midpoint.
 * Uncalibrated page: no label rendered (graceful degradation).
 *
 * Color follows the per-name-group color model (D-29 from Phase 03.1).
 * Hidden-item skip uses composite key `name|categoryId` for O(1) lookup
 * — prevents same-named items in different categories from sharing a toggle.
 */
import { Line, Text, Rect, Group } from 'react-konva'
import type { WallMarkup as WallMarkupType, Category } from '../types/markup'
import type { PageScale } from '../types/scale'
import type { StagePoint } from '../hooks/useCalibrationMode'
import {
  polylineLength,
  polylineMidpointByArcLength
} from '../lib/markup-math'
import { buildArcAwareFlatPoints } from '../lib/arc-math'
import { useProjectStore } from '../stores/projectStore'

export interface WallMarkupProps {
  markup: WallMarkupType
  category: Category // legacy prop compat
  currentZoom: number // zoom-compensated strokes (Pitfall 2)
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

// World-anchored label sizing — labels scale with zoom (D-22/D-34).
// Dark rounded chip behind white text for legibility (D-35 fallback).
const LABEL_FONT_WORLD = 16
const LABEL_PAD_X_WORLD = 6
const LABEL_PAD_Y_WORLD = 3
const LABEL_CHIP_RADIUS_WORLD = 4
// Rough advance width for Inter 600 — used to estimate chip width without
// measuring the rendered glyph bounds. Slight over-estimate is fine.
const CHAR_ADVANCE_RATIO = 0.58
// Base stroke px — divided by currentZoom so lines stay visible at fit zoom (Pitfall 2).
const STROKE_BASE_PX = 2

// Wall-specific visual constants (D-10).
const WALL_STROKE_MULTIPLIER = 2.5 // primary line is 2.5× base stroke
const WALL_OFFSET_WORLD = 3 // parallel hairline perpendicular offset in world units
const WALL_HAIRLINE_OPACITY = 0.7 // hairline is same color at 70% opacity

/**
 * Wall polyline Konva renderer with m² label, hidden-item skip, and parallel
 * hairline affordance. Zoom-compensated strokes per Pitfall 2.
 *
 * Visibility key: composite `name|categoryId` so that items sharing a name
 * in different categories are hidden/shown independently.
 */
export function WallMarkup({
  markup,
  currentZoom,
  pageScale,
  onHoverEnter,
  onHoverLeave,
  onContextMenu,
  onClick,
  onMarkupMouseDown,
  overridePoints
}: WallMarkupProps): React.JSX.Element | null {
  // Hidden-item skip — composite key "name|categoryId" prevents cross-category collision.
  // Place as the very first lines so the rest of the render body is not evaluated.
  const itemKey = `${markup.name}|${markup.categoryId ?? ''}`
  const isHidden = useProjectStore((s) => s.hiddenItemSet.has(itemKey))
  if (isHidden) return null

  // Live drag preview: render overridePoints when supplied, otherwise persistent geometry.
  // Both primary line and hairline use effectivePoints; wallHeight unchanged.
  const effectivePoints = overridePoints ?? markup.points

  // Pitfall 2: both stroke widths MUST divide by currentZoom — never use bare px.
  const primaryStroke = (STROKE_BASE_PX * WALL_STROKE_MULTIPLIER) / currentZoom
  const hairlineStroke = STROKE_BASE_PX / currentZoom

  // Arc-aware: curved wall runs draw + measure along the true arc (matches the
  // arc-corrected m² in the BOQ). Live drag preview falls back to straight
  // chords (the arcs map no longer aligns with the moved points).
  const effectiveArcs = overridePoints ? undefined : markup.arcs
  const flatPoints = buildArcAwareFlatPoints(effectivePoints, effectiveArcs, false)

  const midpoint = polylineMidpointByArcLength(effectivePoints)

  let labelText = ''
  if (pageScale && pageScale.pixelsPerMm > 0 && markup.wallHeight > 0) {
    // Inline arc-aware wall area (length × height in m²) — mirrors the BOQ
    // aggregator's wall branch so the on-canvas label matches the export.
    const pixelLen = polylineLength(effectivePoints, effectiveArcs)
    const lengthM = pixelLen / pageScale.pixelsPerMm / 1000 // px → mm → m
    const heightM = markup.wallHeight / 1000
    const areaM2 = lengthM * heightM
    labelText = `${areaM2.toFixed(2)} m²`
  }

  const textWidth = labelText.length * LABEL_FONT_WORLD * CHAR_ADVANCE_RATIO
  const chipW = textWidth + LABEL_PAD_X_WORLD * 2
  const chipH = LABEL_FONT_WORLD + LABEL_PAD_Y_WORLD * 2
  // Sit the label below the line midpoint with a small gap (matches LinearMarkup convention).
  const chipX = midpoint.x - chipW / 2
  const chipY = midpoint.y + LABEL_FONT_WORLD * 0.6

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
      {/* PRIMARY LINE — 2.5× base stroke, interactive hit area */}
      <Line
        points={flatPoints}
        stroke={markup.color}
        strokeWidth={primaryStroke}
        lineCap="round"
        lineJoin="round"
      />
      {/* HAIRLINE — parallel offset approximation via Konva offsetY, non-interactive */}
      <Line
        points={flatPoints}
        stroke={markup.color}
        strokeWidth={hairlineStroke}
        opacity={WALL_HAIRLINE_OPACITY}
        offsetY={WALL_OFFSET_WORLD}
        lineCap="round"
        lineJoin="round"
        listening={false}
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
