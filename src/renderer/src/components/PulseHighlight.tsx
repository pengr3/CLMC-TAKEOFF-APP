import React, { useEffect, useState } from 'react'
import { Circle, Line } from 'react-konva'
import type { Markup } from '../types/markup'

// UI-SPEC locked values (06-UI-SPEC.md "Pulse visual" / D-12):
//   - 1500ms total fade
//   - opacity: ease-out from 0.85 to 0
//   - stroke: linear from 6/zoom to 2/zoom over the fade ("deflating ring")
//   - color: per-name-group color (Markup.color via aggregator) — NOT
//     hardcoded white. Color travels canvas pin → BOQ row chip → pulse →
//     spreadsheet cell so "Light Switches are blue" everywhere.
//   - Outer offset 8/currentZoom — sits OUTSIDE HoverRing's 4/zoom so the
//     two visuals can stack without overlapping.
//   - Every Konva shape has listening={false} (regression-guarded).
const PULSE_DURATION_MS = 1500
const STROKE_PEAK = 6 // 6/zoom at t=0
const STROKE_END = 2 // 2/zoom at t=1 (linear interpolation)
const OPACITY_PEAK = 0.85
const RING_OFFSET_PX = 8 // → 8/currentZoom outward
// PIN_RADIUS_WORLD mirrors CountPinMarkup.tsx:18 — pins are world-anchored
// (D-22) so the count ring radius is `10 + 8/zoom`.
const PIN_RADIUS_WORLD = 10

export interface PulseHighlightProps {
  /** Markups to pulse. */
  markups: Markup[]
  /** Per-name-group color (Markup.color via aggregator item.color, D-12). */
  color: string
  /** Current Stage zoom; used to keep stroke + offset visually constant. */
  currentZoom: number
  /**
   * Called when the 1500ms fade reaches t=1. Parent (App.tsx orchestrator
   * via useMarkupHighlight.clearPulse) is expected to unmount the component
   * after this fires — the pulse is single-shot and self-removing.
   */
  onComplete: () => void
}

/**
 * PulseHighlight — animated 1500ms fade-out ring rendered on Layer 2
 * transient territory in CanvasViewport when a TotalsRow is clicked and
 * matching markups exist on the navigated-to page (D-12).
 *
 * Pure presentational — runs its own rAF loop that progresses 0 → 1 over
 * 1500ms. Calls `onComplete()` exactly once when t=1; the parent removes
 * the component on the next render. `cancelAnimationFrame(raf)` runs in
 * the useEffect cleanup so unmounts mid-fade do not leave a dangling
 * setState targeting an unmounted component (RESEARCH §3 Pitfall 8).
 *
 * **Every Konva shape has `listening={false}`** — UI-SPEC § "Transient
 * overlay coexistence". A listening pulse over a Count Pin Group would
 * steal hover events from the underlying markup, breaking the existing
 * tooltip flow. Verified by `highlight-overlay-listening.test.ts`.
 */
export function PulseHighlight({
  markups,
  color,
  currentZoom,
  onComplete
}: PulseHighlightProps): React.JSX.Element {
  // progress: 0 → 1 over PULSE_DURATION_MS. Local state so rAF ticks drive
  // re-renders with interpolated opacity / stroke values.
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const loop = (now: number): void => {
      const t = Math.min(1, (now - t0) / PULSE_DURATION_MS)
      setProgress(t)
      if (t < 1) {
        raf = requestAnimationFrame(loop)
      } else {
        onComplete()
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [onComplete])

  // Quadratic ease-out — recognizably "deflating".
  const easeOut = 1 - (1 - progress) ** 2
  const opacity = OPACITY_PEAK * (1 - easeOut)
  // Linear 6 → 2 over the fade (gives the ring a "shockwave" feel without
  // a separate scale animation).
  const strokePx = STROKE_PEAK + (STROKE_END - STROKE_PEAK) * progress
  const stroke = strokePx / currentZoom
  const ringOffset = RING_OFFSET_PX / currentZoom

  return (
    <>
      {markups.map((m) => {
        if (m.type === 'count') {
          return (
            <Circle
              key={m.id}
              x={m.point.x}
              y={m.point.y}
              radius={PIN_RADIUS_WORLD + ringOffset}
              stroke={color}
              strokeWidth={stroke}
              opacity={opacity}
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
              stroke={color}
              strokeWidth={stroke}
              opacity={opacity}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
          )
        }
        // area + perimeter — close the polygon by appending the first point.
        const closing = [...m.points, m.points[0]]
        return (
          <Line
            key={m.id}
            points={closing.flatMap((p) => [p.x, p.y])}
            stroke={color}
            strokeWidth={stroke}
            opacity={opacity}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )
      })}
    </>
  )
}
