import type React from 'react'
import { useViewerStore } from '../stores/viewerStore'
import { useScaleStore } from '../stores/scaleStore'
import { useMarkupStore } from '../stores/markupStore'
import { formatScaleRatio } from '../lib/scale-math'
import { COLORS } from '../lib/constants'
import { usePageLabels } from '../hooks/usePageLabels'
import { getCalibrationControls } from './CanvasViewport'
import type { Markup } from '../types/markup'

/**
 * CanvasHeaderBar — slim 28px status strip mounted above CanvasViewport.
 *
 * D-20: shows the current page label (left) + scale status (right).
 * When the current page is uncalibrated AND has any non-count markups, the
 * scale-status segment renders an inline Set Scale action that reuses the
 * same calibration entry point Toolbar uses (Toolbar.tsx:173-181) — must NOT
 * duplicate the trigger code.
 *
 * The bottom StatusBar is retained unchanged — this header is additive polish
 * placed where the estimator's eyes actually rest while drawing markups.
 *
 * Renders null when totalPages === 0 (UI-SPEC: bar hidden when no PDF). The
 * StatusBar at the bottom continues to show the em-dash fallback in that case.
 */

// Stable empty-array reference for the per-page markup slice selector.
// A fresh `[]` literal inside a Zustand selector breaks useSyncExternalStore's
// Object.is snapshot check and causes an infinite re-render loop. Mirrors
// CanvasViewport.tsx:38 (EMPTY_MARKUPS).
const EMPTY_MARKUPS: Markup[] = []

export function CanvasHeaderBar(): React.JSX.Element | null {
  const totalPages = useViewerStore((s) => s.totalPages)
  const currentPage = useViewerStore((s) => s.currentPage)
  const pageScale = useScaleStore((s) => s.pageScales[currentPage] ?? null)
  const pageMarkups = useMarkupStore((s) => s.pageMarkups[currentPage] ?? EMPTY_MARKUPS)
  const labels = usePageLabels()

  // D-20: bar is not rendered when there is no PDF — center column shows
  // <EmptyState> + bottom StatusBar, identical to pre-Phase 6.
  if (totalPages === 0) return null

  // Resolve page label: PDF-provided label if available, else "Page {N}" fallback.
  const pageLabel = labels?.[currentPage - 1] ?? `Page ${currentPage}`

  // hasNonCountMarkups: any linear / area / perimeter markup on this page.
  // These are the markup types whose totals get silently excluded on
  // uncalibrated pages (BOQ export D-06), so they're the trigger for the
  // user-facing calibration nudge.
  const hasNonCountMarkups = pageMarkups.some((m) => m.type !== 'count')

  // Right-segment content — three branches per UI-SPEC §"CanvasHeaderBar":
  //   (a) calibrated → "1:N" in textPrimary
  //   (b) uncalibrated, no non-count markups → "Not Set" in textSecondary (silent — no nudge)
  //   (c) uncalibrated AND has non-count markups → "Page not calibrated." + Set Scale link
  let rightSegment: React.JSX.Element
  if (pageScale !== null) {
    rightSegment = (
      <span style={{ color: COLORS.textPrimary }}>{formatScaleRatio(pageScale.pixelsPerMm)}</span>
    )
  } else if (!hasNonCountMarkups) {
    rightSegment = <span style={{ color: COLORS.textSecondary }}>Not Set</span>
  } else {
    rightSegment = (
      <span style={{ color: COLORS.warning }}>
        Page not calibrated.{' '}
        <span
          onClick={() => getCalibrationControls()?.activate()}
          style={{
            color: COLORS.accent,
            textDecoration: 'underline',
            cursor: 'pointer'
          }}
        >
          Set Scale
        </span>
      </span>
    )
  }

  return (
    <div
      style={{
        height: 28,
        background: COLORS.secondary,
        borderTop: `1px solid ${COLORS.border}`,
        borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        fontSize: 13,
        lineHeight: 1.4,
        fontWeight: 400,
        color: COLORS.textPrimary,
        flexShrink: 0
      }}
    >
      {/* Left: current page label */}
      <span>{pageLabel}</span>

      {/* Right: scale status (calibrated ratio | "Not Set" | "Page not calibrated." + link) */}
      <span aria-live="polite">{rightSegment}</span>
    </div>
  )
}
