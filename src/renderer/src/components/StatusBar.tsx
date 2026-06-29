import { useViewerStore } from '../stores/viewerStore'
import { useScaleStore } from '../stores/scaleStore'
import { formatScaleRatio } from '../lib/scale-math'
import { COLORS } from '../lib/constants'

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

  const hasFile = totalPages > 0
  const zoomPct = hasFile ? Math.round(getViewport(currentPage).zoom * 100) : 0
  const pageScale = hasFile ? getScale(currentPage) : null

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

  let scaleText: string
  let scaleColor: string
  if (!hasFile) {
    scaleText = '\u2014'
    scaleColor = COLORS.textPrimary
  } else if (pageScale === null) {
    scaleText = 'Not Set'
    scaleColor = COLORS.warning
  } else {
    scaleText = formatScaleRatio(pageScale.pixelsPerMm)
    scaleColor = COLORS.textPrimary
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

      {/* Scale */}
      <span aria-live="polite">
        Scale: <span style={{ color: scaleColor }}>{scaleText}</span>
      </span>

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
