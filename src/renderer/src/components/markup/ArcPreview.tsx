import { Line } from 'react-konva'
import type { StagePoint } from '../../hooks/useCalibrationMode'
import { solveCircle } from '../../lib/arc-math'

/**
 * ArcPreview — the live, dashed, solved-arc preview rendered on the transient
 * overlay layer (Layer 1a) DURING the 3-click arc gesture, between the on-arc
 * click and the end click (14-UI-SPEC § "Arc drawing — 3-click gesture",
 * D-01). The curve is re-solved every mousemove through start → onArc → cursor
 * (the cursor stands in as the provisional `end`), so the estimator sees the
 * arc bending live as they move toward the end point.
 *
 * Pure presentational — no state, no events. It re-runs `solveCircle` (14-01)
 * on every render and:
 *  - when the three points are NOT collinear → samples the solved circle from
 *    `start` to `end` THROUGH `onArc` as a dense polyline (Konva `Line` with
 *    many points) and draws it dashed;
 *  - when the three points ARE collinear (degenerate) → degrades gracefully to
 *    a straight 2-point dashed `Line` start→end, exactly like the existing
 *    straight in-progress preview (T-14-04-01: never an Arc with NaN radius).
 *
 * **Zoom-compensated:** stroke width and dash are screen-pixel constants
 * divided by `currentZoom`, matching the existing dashed straight-segment
 * preview (LINE_STROKE_WIDTH = 2/zoom, LINE_DASH = [8/zoom, 4/zoom]) so the
 * preview reads constant-sized at any zoom.
 *
 * **`listening={false}`** — the preview marks where the curve will land but
 * must never steal pointer events (same discipline as HoverRing / SnapIndicator
 * / the straight preview).
 */

// Screen-pixel constants — divided by currentZoom in the body (mirrors the
// straight in-progress preview in CanvasViewport.tsx).
const STROKE_PX = 2
const DASH_ON_PX = 8
const DASH_OFF_PX = 4

// Number of sampled segments along the arc. 64 keeps the curve visually smooth
// at any practical zoom while staying cheap to re-render every mousemove.
const ARC_SAMPLES = 64

export interface ArcPreviewProps {
  /** Arc start point (the last committed vertex / the edge's start). */
  start: StagePoint
  /** The on-arc shaping point the curve must pass through (click 2). */
  onArc: StagePoint
  /** Provisional end point — the live cursor while moving toward click 3. */
  end: StagePoint
  /** Current Stage zoom; stroke/dash kept visually constant by dividing by this. */
  currentZoom: number
  /** Stroke color — the pending markup color, never a hardcoded hex. */
  color: string
}

/**
 * Sample `count + 1` points evenly along the solved circle using solveCircle's
 * own signed start angle + signed sweep, so the previewed curve is the EXACT arc
 * the measurement (`sweep` magnitude) describes. CR-01: never re-derive the
 * start→onArc→end tie-break here — the previous independent re-derivation
 * (`<` vs `<=`) could diverge from solveCircle at the semicircle boundary.
 * Returns a flat [x0,y0,x1,y1,...] array.
 */
function sampleArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  sweepSigned: number,
  count: number
): number[] {
  const pts: number[] = []
  for (let i = 0; i <= count; i++) {
    const a = startAngle + (sweepSigned * i) / count
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a))
  }
  return pts
}

export function ArcPreview({
  start,
  onArc,
  end,
  currentZoom,
  color
}: ArcPreviewProps): React.JSX.Element {
  const strokeWidth = STROKE_PX / currentZoom
  const dash = [DASH_ON_PX / currentZoom, DASH_OFF_PX / currentZoom]

  const solution = solveCircle(start, onArc, end)

  // Collinear (or any non-finite input) → graceful straight 2-point dashed
  // Line, identical in style to the existing straight preview. No Arc, no NaN.
  if (solution.collinear) {
    return (
      <Line
        points={[start.x, start.y, end.x, end.y]}
        stroke={color}
        strokeWidth={strokeWidth}
        dash={dash}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    )
  }

  // Non-collinear → sampled curve through start → onArc → end, driven by
  // solveCircle's signed start angle + signed sweep (CR-01).
  const points = sampleArc(
    solution.cx,
    solution.cy,
    solution.r,
    solution.startAngle,
    solution.sweepSigned,
    ARC_SAMPLES
  )

  return (
    <Line
      points={points}
      stroke={color}
      strokeWidth={strokeWidth}
      dash={dash}
      lineCap="round"
      lineJoin="round"
      listening={false}
    />
  )
}
