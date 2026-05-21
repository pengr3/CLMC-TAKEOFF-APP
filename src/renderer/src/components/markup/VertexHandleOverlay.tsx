import { Rect, Group } from 'react-konva'
import type { Markup } from '../../types/markup'
import type { StagePoint } from '../../hooks/useCalibrationMode'

/**
 * Renders zoom-compensated 8×8px square vertex handles for ONE markup that is
 * currently in vertex-edit mode (D-04 / D-05).
 *
 * Handle visual spec (D-05):
 *  - 8×8 screen pixels, white fill, colored border matching markup.color
 *  - Border 1.5px screen-stroke
 *  - Hit area 16×16 screen pixels (larger than visual for precision — RESEARCH Finding 3)
 *
 * Hit detection:
 *  - Each Rect carries name={`handle-${i}`}; Wave 3's handleStageMouseDown reads
 *    e.target.name()?.startsWith('handle-') to disambiguate handle clicks from
 *    body clicks (RESEARCH Finding 4).
 *  - onMouseDown sets e.cancelBubble=true so the Stage-level handler does not
 *    ALSO fire (which would start a rubber-band or body drag).
 *
 * Count pins (D-09): no vertex handles. Count pins translate only — return null.
 *
 * Wired into CanvasViewport in Wave 3; standalone here so it can be tested and
 * type-checked in isolation.
 */

// Screen-pixel constants — zoom-compensated at call-site (D-05).
const HANDLE_SIZE_PX = 8
const HANDLE_STROKE_PX = 1.5
const HANDLE_HIT_PX = 16

export interface VertexHandleOverlayProps {
  /** The markup currently in vertex-edit mode. */
  markup: Markup
  /** Current canvas zoom; handles scale inversely to stay constant on screen. */
  currentZoom: number
  /** Called when a handle's mousedown fires, with the vertex index. */
  onHandleMouseDown?: (vertexIndex: number) => void
}

export function VertexHandleOverlay({
  markup,
  currentZoom,
  onHandleMouseDown
}: VertexHandleOverlayProps): React.JSX.Element | null {
  // Zoom-compensation: divide screen-pixel constants by currentZoom so handles
  // appear constant-sized on screen at any zoom level (D-05).
  const handleSize = HANDLE_SIZE_PX / currentZoom
  const handleStroke = HANDLE_STROKE_PX / currentZoom
  const hitSize = HANDLE_HIT_PX / currentZoom

  // Count pins have no vertex handles — they only translate (D-09 rule).
  const points: StagePoint[] = markup.type === 'count' ? [] : markup.points

  if (points.length === 0) return null

  return (
    <Group>
      {points.map((p, i) => (
        <Rect
          key={i}
          name={`handle-${i}`}
          x={p.x - handleSize / 2}
          y={p.y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          fill="#ffffff"
          stroke={markup.color}
          strokeWidth={handleStroke}
          hitWidth={hitSize}
          hitHeight={hitSize}
          // CRITICAL: handles MUST be listening=true — unlike HoverRing/PulseHighlight (Pitfall 6 in 12-RESEARCH.md)
          listening={true}
          onMouseDown={(e) => {
            // Stop propagation so Stage onMouseDown does not also fire for this handle click
            e.cancelBubble = true
            onHandleMouseDown?.(i)
          }}
        />
      ))}
    </Group>
  )
}
