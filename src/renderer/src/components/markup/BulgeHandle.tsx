import { useState } from 'react'
import { Circle, Group } from 'react-konva'
import type Konva from 'konva'
import type { Markup } from '../../types/markup'
import { COLORS } from '../../lib/constants'

/**
 * Renders zoom-compensated round bulge handles — the curvature EDIT gesture for
 * arc edges (D-08). One handle per arc edge of a markup currently in vertex-edit
 * mode, positioned on the arc edge's on-arc midpoint (the third point of the
 * 3-point circle solve, stored in `markup.arcs[segmentIndex]`).
 *
 * Handle visual spec (14-UI-SPEC §"Bulge handle (D-08)"):
 *  - Konva `Circle` (round — distinct from the square 8px white vertex handle)
 *  - Resting diameter 9px (`9/zoom`, radius `4.5/zoom`), fill COLORS.accent,
 *    stroke 1.5px (`1.5/zoom`) white
 *  - Hover grows to 12px diameter (`12/zoom`), stroke 2px white
 *  - Hit target 18px (`18/zoom`) hitWidth/hitHeight — larger than the visual for
 *    precision (mirrors VertexHandleOverlay's hit > visual rule, RESEARCH Finding 3)
 *
 * Hit detection (mirrors VertexHandleOverlay):
 *  - Each Circle carries name={`bulge-${segmentIndex}`}; CanvasViewport's
 *    handleStageMouseDown reads e.target.name()?.startsWith('bulge-') to route the
 *    bulge-drag gesture.
 *  - onMouseDown sets e.cancelBubble=true so the Stage-level handler does not ALSO
 *    fire (which would start a rubber-band or body drag).
 *
 * Count pins have no edges, hence no bulge handles — and a markup with no `arcs`
 * map renders nothing (all-straight edges).
 *
 * Listening=true — unlike the snap glyphs / HoverRing (listening=false), this is an
 * interactive handle that must receive pointer events.
 */

// Screen-pixel constants — zoom-compensated at call-site (UI-SPEC).
const BULGE_DIAMETER_PX = 9
const BULGE_HOVER_DIAMETER_PX = 12
const BULGE_STROKE_PX = 1.5
const BULGE_HOVER_STROKE_PX = 2
const BULGE_HIT_PX = 18

export interface BulgeHandleProps {
  /** The markup currently in vertex-edit mode (carries the arcs map). */
  markup: Markup
  /** Current canvas zoom; handles scale inversely to stay constant on screen. */
  currentZoom: number
  /** Called when a bulge handle's mousedown fires, with the arc edge's segment index. */
  onHandleMouseDown?: (segmentIndex: number) => void
}

export function BulgeHandle({
  markup,
  currentZoom,
  onHandleMouseDown
}: BulgeHandleProps): React.JSX.Element | null {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Count pins have no edges; markups with no arcs map have no curved edges.
  if (markup.type === 'count') return null
  const arcs = markup.arcs
  if (!arcs) return null

  const entries = Object.entries(arcs)
  if (entries.length === 0) return null

  // Zoom-compensation: divide screen-pixel constants by currentZoom so handles
  // appear constant-sized on screen at any zoom level.
  const hitSize = BULGE_HIT_PX / currentZoom

  return (
    <Group>
      {entries.map(([key, mid]) => {
        const segmentIndex = Number(key)
        const hovered = hoveredIndex === segmentIndex
        const diameter = (hovered ? BULGE_HOVER_DIAMETER_PX : BULGE_DIAMETER_PX) / currentZoom
        const stroke = (hovered ? BULGE_HOVER_STROKE_PX : BULGE_STROKE_PX) / currentZoom
        return (
          <Circle
            key={key}
            name={`bulge-${segmentIndex}`}
            x={mid.midX}
            y={mid.midY}
            radius={diameter / 2}
            fill={COLORS.accent}
            stroke="#ffffff"
            strokeWidth={stroke}
            hitWidth={hitSize}
            hitHeight={hitSize}
            // CRITICAL: bulge handles MUST be listening=true (interactive edit gesture).
            listening={true}
            onMouseEnter={() => setHoveredIndex(segmentIndex)}
            onMouseLeave={() => setHoveredIndex((cur) => (cur === segmentIndex ? null : cur))}
            onMouseDown={(e: Konva.KonvaEventObject<MouseEvent>) => {
              // Stop propagation so Stage onMouseDown does not also fire for this handle.
              e.cancelBubble = true
              onHandleMouseDown?.(segmentIndex)
            }}
          />
        )
      })}
    </Group>
  )
}
