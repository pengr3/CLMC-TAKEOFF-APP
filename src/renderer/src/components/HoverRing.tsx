import React from 'react'
import { Circle, Line } from 'react-konva'
import type { Markup } from '../types/markup'

// UI-SPEC locked values (06-UI-SPEC.md "Hover an item row" / D-11):
//   - White stroke at 40% opacity, instant appear/disappear (no fade).
//   - Visually distinct from the click pulse (PulseHighlight): white & static
//     here vs. per-name colored & animated there.
//   - Outer ring sits +4/currentZoom OUTSIDE the markup geometry.
//   - Stroke is zoom-compensated (divided by currentZoom) so the visual size
//     stays constant on screen at any zoom level — the load-bearing
//     CLAUDE.md / STATE.md "markup pinning at any zoom" discipline.
const STROKE_BASE_PX = 2 // → 2 / currentZoom on screen
const RING_OFFSET_PX = 4 // → 4 / currentZoom outward
const RING_OPACITY = 0.4
const RING_COLOR = '#ffffff'
// PIN_RADIUS_WORLD mirrors the value declared at CountPinMarkup.tsx:18 — pins
// are pure world-anchored (D-22), so the ring radius is `10 + offset` with
// offset ALSO divided by zoom. Result: at fit-zoom the ring is small (matching
// the small pin) and at 8x zoom the ring is comfortably outside the pin.
const PIN_RADIUS_WORLD = 10

export interface HoverRingProps {
  /** Markups to outline. Empty array → component renders nothing. */
  markups: Markup[]
  /** Current Stage zoom; used to keep stroke/offset visually constant. */
  currentZoom: number
}

/**
 * HoverRing — steady, non-animated white outer ring rendered on Layer 2
 * transient territory in CanvasViewport when a TotalsRow is hovered (D-11).
 *
 * Pure presentational — the parent (App.tsx orchestrator owning
 * useMarkupHighlight) owns mount/unmount via the `hoverMatches` state.
 *
 * **Every Konva shape has `listening={false}`** — the load-bearing rule from
 * UI-SPEC § "Transient overlay coexistence". A listening ring on top of a
 * Count Pin Group would steal the underlying Group's `onMouseEnter` /
 * `onContextMenu` events, breaking the existing tooltip and recolor flows.
 * This is verified by `highlight-overlay-listening.test.ts` (regression
 * guard).
 */
export function HoverRing({ markups, currentZoom }: HoverRingProps): React.JSX.Element {
  const stroke = STROKE_BASE_PX / currentZoom
  const offset = RING_OFFSET_PX / currentZoom

  return (
    <>
      {markups.map((m) => {
        if (m.type === 'count') {
          return (
            <Circle
              key={m.id}
              x={m.point.x}
              y={m.point.y}
              radius={PIN_RADIUS_WORLD + offset}
              stroke={RING_COLOR}
              strokeWidth={stroke}
              opacity={RING_OPACITY}
              fill="transparent"
              listening={false}
            />
          )
        }
        if (m.type === 'linear') {
          return (
            <Line
              key={m.id}
              points={m.points.flatMap((p) => [p.x, p.y])}
              stroke={RING_COLOR}
              // Wider envelope around the polyline so the ring reads as an
              // outer outline rather than overlapping the line itself.
              strokeWidth={stroke + offset * 2}
              opacity={RING_OPACITY}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
          )
        }
        // area + perimeter — closed polygon outline (close by appending the
        // first point so Konva renders the closing segment).
        const closing = [...m.points, m.points[0]]
        return (
          <Line
            key={m.id}
            points={closing.flatMap((p) => [p.x, p.y])}
            stroke={RING_COLOR}
            strokeWidth={stroke + offset * 2}
            opacity={RING_OPACITY}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )
      })}
    </>
  )
}
