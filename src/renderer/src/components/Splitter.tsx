import { useCallback, useState } from 'react'
import type React from 'react'
import { COLORS } from '../lib/constants'

/**
 * Splitter — 4px drag-resize handle for the Phase 6 three-column shell.
 *
 * Used between ThumbnailStrip ↔ CanvasViewport (left) and CanvasViewport ↔
 * TotalsPanel (right). The visible divider is a 1px line; the surrounding
 * 4px region acts as a generous mouse hit-target (`splitterHitWidth` token).
 *
 * Locked design (RESEARCH §6 lines 1018-1094):
 *   - onPointerDown registers pointermove + pointerup on `window` (NOT on the
 *     element itself — Pitfall 11). Element-scoped listeners drop events when
 *     the cursor moves outside the 4px strip during a drag.
 *   - onDragWidth fires every pointermove with the clamped candidate width;
 *     parent typically writes this into local state to drive live render.
 *   - onCommit fires once on pointerup with the final width; parent typically
 *     calls useUiPanels().setThumbnailsWidth(width) here so localStorage is
 *     written once per drag, not 60-120 times/second.
 *   - Width is clamped: max(minWidth, min(containerWidth * 0.5, startWidth + dx)).
 *     The 50% cap (UI-SPEC) prevents either panel from starving the canvas.
 *
 * Threat T-06-02-01 (tampering — raw clientX): clamp range applied on every
 * pointermove via Math.max/Math.min. Threat T-06-02-02 (DOS — listener leak):
 * pointerup handler removes both window listeners atomically; no retain path
 * exists unless the component unmounts mid-drag (acceptable — drag always
 * ends on the next pointerup or window blur).
 */
interface SplitterProps {
  /** 'left' = drag right grows the left panel; 'right' = drag left grows the right panel. */
  side: 'left' | 'right'
  /** Current committed panel width (from useUiPanels). */
  panelWidth: number
  /** Container width — used to compute the 50% max clamp. */
  containerWidth: number
  /** Min panel width (auto-collapse threshold below this — slimRailWidth = 28). */
  minWidth: number
  /** Live drag callback — receives the clamped candidate width on every pointermove. */
  onDragWidth: (newWidth: number) => void
  /** Pointer-up callback — receives the final width to commit (e.g. localStorage write). */
  onCommit: (finalWidth: number) => void
  /** Accessibility label for the separator role. */
  ariaLabel: string
}

export function Splitter({
  side,
  panelWidth,
  containerWidth,
  minWidth,
  onDragWidth,
  onCommit,
  ariaLabel
}: SplitterProps): React.JSX.Element {
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = panelWidth
      setIsDragging(true)
      let lastWidth = startWidth

      const onMove = (ev: PointerEvent): void => {
        const dx = side === 'left' ? ev.clientX - startX : startX - ev.clientX
        // Clamp range mitigates T-06-02-01 (raw clientX tampering).
        const next = Math.max(minWidth, Math.min(containerWidth * 0.5, startWidth + dx))
        lastWidth = next
        onDragWidth(next)
      }
      const onUp = (): void => {
        // Atomic listener removal — mitigates T-06-02-02 (listener leak).
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        setIsDragging(false)
        onCommit(lastWidth)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [side, panelWidth, containerWidth, minWidth, onDragWidth, onCommit]
  )

  // Tri-state visible stripe: idle border, hover hoverSurface, active accent.
  const stripeColor = isDragging ? COLORS.accent : isHovered ? COLORS.hoverSurface : COLORS.border

  return (
    <div
      role="separator"
      aria-label={ariaLabel}
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: 4, // splitterHitWidth — UI-SPEC locked
        cursor: 'col-resize',
        background: 'transparent',
        position: 'relative',
        flexShrink: 0,
        userSelect: 'none'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 1.5,
          width: 1, // 1px visible line, centered in 4px hit area
          background: stripeColor,
          transition: 'background 100ms ease-out'
        }}
      />
    </div>
  )
}
