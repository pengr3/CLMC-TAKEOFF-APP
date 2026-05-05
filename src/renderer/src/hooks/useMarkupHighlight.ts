import { useCallback, useState } from 'react'
import type { Markup } from '../types/markup'

/**
 * useMarkupHighlight — transient overlay lifecycle hook for Phase 6 row → canvas
 * highlight bridges (D-11 hover ring + D-12 click pulse).
 *
 * Encapsulates the parent-owned-lifecycle state for both:
 *   - Hover ring (steady, white, 40% opacity) — appears while user hovers a
 *     TotalsRow; matches limited to the currently visible page (D-11).
 *   - Click pulse (animated, per-name colored, 1500ms fade) — fires when a
 *     TotalsRow is clicked and matching markups exist on the navigated-to page
 *     (D-12).
 *
 * Recommended ownership (RESEARCH §3 Q1 / PATTERNS line 751): App.tsx-as-
 * orchestrator. App.tsx calls `useMarkupHighlight()`, passes the setters down
 * to TotalsPanel, and `hoverMatches` / `pulse` as props to CanvasViewport.
 * Mirrors how App.tsx already routes useExport / useProject return values.
 *
 * All clearers and `triggerPulse` are stable `useCallback` references so
 * consumers (TotalsRow, CanvasViewport) can put them in effect dep arrays
 * without churn. `setHoverMatches` is the raw `useState` setter (also stable).
 */
export interface MarkupHighlightApi {
  /** Currently hovered matches — empty array means no hover overlay. */
  hoverMatches: Markup[]
  /** Replace the hover-match list — usually called from TotalsRow onMouseEnter. */
  setHoverMatches: (matches: Markup[]) => void
  /** Clear hover overlay (mouse-leave, page-change, panel collapse). */
  clearHover: () => void

  /**
   * Active click-pulse, or null when no pulse is in flight.
   * `color` is the per-name color (`getColorForName(name)`) so the pulse
   * matches the canvas pin and the BOQ row chip.
   */
  pulse: { matches: Markup[]; color: string } | null
  /** Fire a pulse — usually called from TotalsRow onClick after navigation lands. */
  triggerPulse: (matches: Markup[], color: string) => void
  /** Clear pulse — called by PulseHighlight onComplete + CanvasViewport on page-change. */
  clearPulse: () => void
}

export function useMarkupHighlight(): MarkupHighlightApi {
  const [hoverMatches, setHoverMatchesState] = useState<Markup[]>([])
  const [pulse, setPulse] = useState<{ matches: Markup[]; color: string } | null>(null)

  return {
    hoverMatches,
    setHoverMatches: setHoverMatchesState,
    clearHover: useCallback(() => setHoverMatchesState([]), []),
    pulse,
    triggerPulse: useCallback(
      (matches: Markup[], color: string) => setPulse({ matches, color }),
      []
    ),
    clearPulse: useCallback(() => setPulse(null), [])
  }
}
