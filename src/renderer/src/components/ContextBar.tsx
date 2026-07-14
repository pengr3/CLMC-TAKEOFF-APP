import React from 'react'
import { useViewerStore } from '../stores/viewerStore'
import { isMarkupTool } from '../types/viewer'
import { getChainArmedItem } from './CanvasViewport'
import { getArcSticky, subscribeArcSticky, getArcStickyToggleHandler } from '../lib/markup-arc-ref'
import { COLORS } from '../lib/constants'

/**
 * ContextBar — the thin sub-bar under the top action bar that morphs with state
 * (Phase 18, D-04 / SC-3 / SC-4). Mounted by App.tsx in 18-09; standalone until then.
 *
 * Four mutually-exclusive states keyed on `activeTool` + `selectedMarkupIds`:
 *   placing  = isMarkupTool(activeTool)               → chain item + Snap/Arc + hint
 *   scale    = activeTool === 'scale'                 → calibration hint
 *   selected = activeTool === 'select' && sel.length  → inline name/category/Recolor/Delete
 *   idle     = otherwise                              → single hint line
 * Exactly one morph-state root (`context-bar-{placing|scale|selected|idle}`) renders
 * at a time (mockup.html ctxBar()).
 *
 * The Snap/Arc mini-toggles mutate the SAME state as the ToolRail (D-05): Snap via
 * viewerStore.setSnapEnabled (F3-shared), Arc via the registered Shift+A handler. The
 * Arc on-state is read through the 18-04 reactive seam
 * `useSyncExternalStore(subscribeArcSticky, getArcSticky)` — Shift+A flips sticky arc
 * with NO coincident store change, so a bare getArcSticky() read would leave the pill
 * stale until an unrelated re-render.
 *
 * The canvas edit popup + right-click MarkupContextMenu are UNTOUCHED — this bar is an
 * additive surface (Q2). COLORS tokens + inline styles only (chrome-path convention).
 *
 * SCOPE FLAG (D-04): the placing-state item name is a DISPLAY label (color swatch +
 * getChainArmedItem().name), NOT a live-editable input. The phase's only new plumbing
 * is the Arc seam; live-rename-during-placement has no existing seam. Group rename
 * stays fully reachable in the selected state + the totals/estimate surfaces.
 */

// mockup.html .ctx — 34px COLORS.dominant strip, borderBottom hairline, horizontal row.
const BAR_STYLE: React.CSSProperties = {
  height: 34,
  background: COLORS.dominant,
  borderBottom: `1px solid ${COLORS.border}`,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 12px',
  flexShrink: 0,
  overflowX: 'auto',
  whiteSpace: 'nowrap'
}

// Each morph-state root is a nested flex row so its children lay out with the same
// 8px gap regardless of which state is active.
const ROOT_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0
}

// mockup.html .ctag — uppercase state pill.
const TAG_STYLE: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: COLORS.textSecondary,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 3,
  padding: '2px 6px',
  flexShrink: 0
}

// mockup.html .chint — italic secondary-text hint.
const HINT_STYLE: React.CSSProperties = {
  color: COLORS.textSecondary,
  fontSize: 12,
  fontStyle: 'italic'
}

// mockup.html .chip — bordered display chip (category name / "Chain ●").
const CHIP_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: COLORS.textPrimary,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 3,
  padding: '2px 6px',
  flexShrink: 0
}

// mockup.html .cdiv — 1px vertical hairline between control groups.
const DIVIDER_STYLE: React.CSSProperties = {
  width: 1,
  height: 18,
  background: COLORS.border,
  flexShrink: 0
}

// mockup.html .cinput swatch — 12px rounded color chip preceding a display/edit field.
const SWATCH_STYLE: React.CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: 3,
  flexShrink: 0
}

const TOOL_LABELS: Record<string, string> = {
  count: 'Count',
  linear: 'Linear',
  area: 'Area',
  perimeter: 'Perimeter',
  wall: 'Wall'
}

interface MiniToggleProps {
  testId: string
  label: string
  /** aria-pressed source (toggle on/off truth). */
  pressed: boolean
  /** Accent on-state chrome (accent text + border + dot). */
  on: boolean
  /** Dimmed chrome (e.g. Snap momentarily suspended by Alt). */
  dimmed?: boolean
  onClick: () => void
  title?: string
}

/**
 * mockup.html .mini — reusable pill toggle used for both Snap and Arc. On-state
 * flips text + border to the accent color and lights the leading dot.
 */
function MiniToggle({
  testId,
  label,
  pressed,
  on,
  dimmed = false,
  onClick,
  title
}: MiniToggleProps): React.JSX.Element {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={pressed}
      onClick={onClick}
      title={title}
      style={{
        height: 24,
        padding: '0 9px',
        borderRadius: 12,
        border: `1px solid ${on ? COLORS.accent : COLORS.border}`,
        background: 'transparent',
        color: on ? COLORS.accent : COLORS.textSecondary,
        font: 'inherit',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        flexShrink: 0,
        opacity: dimmed ? 0.7 : 1
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}
      />
      {label}
    </button>
  )
}

export function ContextBar(): React.JSX.Element {
  const activeTool = useViewerStore((s) => s.activeTool)
  const selectedMarkupIds = useViewerStore((s) => s.selectedMarkupIds)
  const snapEnabled = useViewerStore((s) => s.snapEnabled)
  const snapSuspended = useViewerStore((s) => s.snapSuspended)
  const setSnapEnabled = useViewerStore((s) => s.setSnapEnabled)

  // 18-04 reactive Arc on-state — MUST subscribe to the seam (not a bare read) so
  // Shift+A updates the pill with no other interaction (Pitfall 1).
  const arcOn = React.useSyncExternalStore(subscribeArcSticky, getArcSticky)

  // Morph state — mutually exclusive by construction (isMarkupTool/'scale'/'select').
  const placing = isMarkupTool(activeTool)
  const scale = activeTool === 'scale'
  const selected = activeTool === 'select' && selectedMarkupIds.length > 0

  // Snap/Arc mini-toggles — mutate the SAME state the rail does (D-05).
  const snapToggle = (
    <MiniToggle
      testId="context-snap-toggle"
      label="Snap"
      pressed={snapEnabled}
      on={snapEnabled && !snapSuspended}
      dimmed={snapEnabled && snapSuspended}
      onClick={() => setSnapEnabled(!snapEnabled)}
      title="Snap to vertices/edges (F3 · hold Alt to suspend)"
    />
  )
  const arcToggle = (
    <MiniToggle
      testId="context-arc-toggle"
      label="Arc"
      pressed={arcOn}
      on={arcOn}
      onClick={() => getArcStickyToggleHandler()?.()}
      title="Sticky arc segments (Shift+A · hold A for one-off)"
    />
  )

  // Chain-armed read (Pitfall 6): read during render; re-renders are driven by
  // activeTool store changes, matching the ToolRail / RibbonToolbar pattern.
  const armed = placing ? getChainArmedItem() : null

  return (
    <div data-testid="context-bar" style={BAR_STYLE}>
      {placing && (
        <div data-testid="context-bar-placing" style={ROOT_STYLE}>
          <span style={TAG_STYLE}>Placing</span>
          <b style={{ color: COLORS.textOnAccent, fontWeight: 600 }}>
            {TOOL_LABELS[activeTool] ?? activeTool}
          </b>
          {armed !== null && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: COLORS.secondary,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 4,
                padding: '2px 8px',
                height: 26,
                flexShrink: 0
              }}
            >
              <span style={{ ...SWATCH_STYLE, background: armed.color }} />
              <span style={{ color: COLORS.textPrimary }}>{armed.name}</span>
            </span>
          )}
          <span style={DIVIDER_STYLE} />
          {snapToggle}
          {arcToggle}
          {armed !== null && (
            <>
              <span style={DIVIDER_STYLE} />
              <span style={CHIP_STYLE}>Chain ●</span>
            </>
          )}
          <span style={HINT_STYLE}>Enter to finish · Esc to cancel</span>
        </div>
      )}

      {scale && (
        <div data-testid="context-bar-scale" style={ROOT_STYLE}>
          <span style={TAG_STYLE}>Set Scale</span>
          <span style={HINT_STYLE}>
            Draw a line over a known dimension, then type its real length. Everything else
            stays put — no tab change.
          </span>
        </div>
      )}

      {selected && (
        <div data-testid="context-bar-selected" style={ROOT_STYLE}>
          <span style={TAG_STYLE}>Selected</span>
        </div>
      )}

      {!placing && !scale && !selected && (
        <div data-testid="context-bar-idle" style={ROOT_STYLE}>
          <span style={HINT_STYLE}>
            Pick a tool to mark up, or click a markup to edit it — every control above is
            one click away.
          </span>
        </div>
      )}
    </div>
  )
}
