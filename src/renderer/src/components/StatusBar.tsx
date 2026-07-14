import { useViewerStore } from '../stores/viewerStore'
import { useScaleStore } from '../stores/scaleStore'
import { useMarkupStore } from '../stores/markupStore'
import { formatScaleRatio } from '../lib/scale-math'
import { COLORS } from '../lib/constants'
import { getCalibrationControls } from './CanvasViewport'
import type { Markup } from '../types/markup'

// Stable empty-array reference for the per-page markup slice selector (Pitfall 6).
// A fresh `[]` literal inside a Zustand selector breaks useSyncExternalStore's
// Object.is snapshot check and causes an infinite re-render loop. Mirrors
// CanvasHeaderBar.tsx:31 (EMPTY_MARKUPS).
const EMPTY_MARKUPS: Markup[] = []

function Divider(): React.JSX.Element {
  return (
    <div
      style={{
        width: 1,
        height: 16,
        background: '#3c3c3c',
        margin: '0 16px',
        flexShrink: 0
      }}
    />
  )
}

export function StatusBar(): React.JSX.Element {
  const { fileName, totalPages, currentPage } = useViewerStore()
  const getViewport = useViewerStore((s) => s.getViewport)
  const getScale = useScaleStore((s) => s.getScale)
  // Phase 14 (14-03 D-03): snap state for the ON / held-off / OFF pill.
  const snapEnabled = useViewerStore((s) => s.snapEnabled)
  const snapSuspended = useViewerStore((s) => s.snapSuspended)
  // 18-06 (SC-5): per-page markup slice (stable EMPTY_MARKUPS ref) drives the folded
  // "Page not calibrated → Set Scale" nudge migrated from CanvasHeaderBar.
  const pageMarkups = useMarkupStore((s) => s.pageMarkups[currentPage] ?? EMPTY_MARKUPS)

  const hasFile = totalPages > 0
  const zoomPct = hasFile ? Math.round(getViewport(currentPage).zoom * 100) : 0
  const pageScale = hasFile ? getScale(currentPage) : null
  // hasNonCountMarkups: any linear / area / perimeter / wall markup on this page — the
  // markup types whose totals are silently excluded on an uncalibrated page (BOQ D-06),
  // so they trigger the calibration nudge (branch c below).
  const hasNonCountMarkups = pageMarkups.some((m) => m.type !== 'count')

  // Snap pill copy + color (14-UI-SPEC § "Snap status indicator"):
  //   OFF (persistent)  → "Snap: OFF"      amber #e8a838 (COLORS.warning)
  //   held off (Alt)    → "Snap: held off" dimmed #808080 (COLORS.textSecondary)
  //   ON (default)      → "Snap: ON"       #cccccc text + accent #0078d4 dot
  let snapText: string
  let snapColor: string
  if (!snapEnabled) {
    snapText = 'OFF'
    snapColor = COLORS.warning
  } else if (snapSuspended) {
    snapText = 'held off'
    snapColor = COLORS.textSecondary
  } else {
    snapText = 'ON'
    snapColor = COLORS.textPrimary
  }

  // Scale segment \u2014 folded from CanvasHeaderBar (18-06 / D-06). Guarded by hasFile:
  //   (no file) \u2192 em-dash fallback (unchanged)
  //   (a) calibrated \u2192 "1:N" ratio in textPrimary
  //   (b) uncalibrated & !hasNonCountMarkups \u2192 "Not Set" in textSecondary (silent)
  //   (c) uncalibrated & hasNonCountMarkups  \u2192 warning "Page not calibrated." + an accent
  //       underlined "Set Scale" link that REUSES getCalibrationControls().activate()
  //       (Pitfall 5 / STATE.md:151 \u2014 do NOT duplicate the calibration trigger).
  let scaleSegment: React.JSX.Element
  if (!hasFile) {
    scaleSegment = <span>{'\u2014'}</span>
  } else if (pageScale !== null) {
    scaleSegment = (
      <span style={{ color: COLORS.textPrimary }}>{formatScaleRatio(pageScale.pixelsPerMm)}</span>
    )
  } else if (!hasNonCountMarkups) {
    scaleSegment = <span style={{ color: COLORS.textSecondary }}>Not Set</span>
  } else {
    scaleSegment = (
      <span style={{ color: COLORS.warning }}>
        Page not calibrated.{' '}
        <span
          data-testid="status-set-scale-link"
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
        background: '#252526',
        borderTop: '1px solid #3c3c3c',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        fontSize: 13,
        fontWeight: 400,
        color: '#cccccc',
        flexShrink: 0
      }}
    >
      {/* Left: filename */}
      <span
        style={{
          maxWidth: 300,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {hasFile ? fileName : '\u2014'}
      </span>

      <Divider />

      {/* Center: page */}
      <span>
        {hasFile ? `Page ${currentPage} of ${totalPages}` : '\u2014'}
      </span>

      <Divider />

      {/* Zoom */}
      <span>{hasFile ? `Zoom: ${zoomPct}%` : '\u2014'}</span>

      <Divider />

      {/* Scale (18-06): calibrated ratio | "Not Set" | "Page not calibrated." + Set Scale nudge */}
      <span aria-live="polite">Scale: {scaleSegment}</span>

      <Divider />

      {/* Snap (Phase 14 D-03): ON shows an accent dot; held-off is dimmed; OFF is amber. */}
      <span
        aria-live="polite"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        Snap: <span style={{ color: snapColor }}>{snapText}</span>
        {snapEnabled && !snapSuspended && (
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: COLORS.accent,
              display: 'inline-block'
            }}
          />
        )}
      </span>
    </div>
  )
}
