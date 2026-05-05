import type React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { COLORS } from '../lib/constants'
import { useBoqLive } from '../hooks/useBoqLive'
import { useViewerStore } from '../stores/viewerStore'
import { useMarkupStore } from '../stores/markupStore'
import { TotalsPanelHeader } from './TotalsPanelHeader'
import { TotalsCategoryBlock } from './TotalsCategoryBlock'
import type { BoqItemRow } from '../lib/boq-types'
import type { Markup } from '../types/markup'

/**
 * TotalsPanel — right-column chrome of the three-column app shell.
 *
 * Renders metadata header + scrollable category list + pinned grand-total bar
 * over a live BoqStructure (from useBoqLive — single aggregator subscription
 * per RESEARCH §2 / 06-PATTERNS.md).
 *
 * Empty-state decision tree (D-09 / UI-SPEC §"Empty States" — exact copy):
 *   - totalPages === 0 → "Open a PDF to begin."
 *   - totalPages > 0 AND totalMarkups === 0 → "Place markups to see totals."
 *   - markups exist BUT no categories rendered (only non-count markups on
 *     uncalibrated pages) → "Place markups on a calibrated page to see length
 *     and area totals."
 *   - Otherwise → render categories normally.
 *
 * The metadata header ALWAYS renders, even in empty states — fields show "—"
 * em-dash when there's no project open (06-UI-SPEC line 320 explicit).
 *
 * NOT inside TotalsPanel: EMPTY_MARKUPS fallback selectors (RESEARCH §2 line
 * 240-243) — the aggregator's output is always fully formed; no defensive
 * fallback needed here.
 *
 * Collapsed rail (UI-SPEC §"Layout"): when `open === false`, renders a slim
 * 28px column with a ChevronLeft glyph and aria-label "Expand Totals". The
 * collapse/expand toggle is owned by the parent (App.tsx orchestrator wires
 * via useUiPanels in Plan 06-05 / Wave 6).
 *
 * Row interaction handlers (onRowHover / onRowClick / onRowContextMenu) are
 * accepted as optional props now and threaded through to TotalsCategoryBlock /
 * TotalsRow. They are wired to useMarkupHighlight + cycle navigation in Plan
 * 06-05 — the row already invokes them so no further changes are needed
 * downstream.
 */
export interface TotalsPanelProps {
  open: boolean
  width: number
  onSetOpen: (open: boolean) => void
  /** onSetWidth is plumbed for future Splitter integration — kept for shape parity. */
  onSetWidth?: (width: number) => void
  onRowHover?: (matches: Markup[]) => void
  onRowClick?: (item: BoqItemRow, categoryName: string) => void
  onRowContextMenu?: (item: BoqItemRow, x: number, y: number) => void
  /** Cycle indices keyed by `${categoryName}|${itemLabel}` → 1-based cycle position. */
  cycleIndexByKey?: Record<string, number>
}

const RAIL_WIDTH = 28
const SPLITTER_ANIM_MS = 150

// Stable empty array reference — per-render fallback for the page-markups
// selector. Returning a fresh `[]` each render triggers Zustand subscriber
// re-runs and loops React with the "Maximum update depth exceeded" guard.
const EMPTY_MARKUPS: Markup[] = []

export function TotalsPanel(props: TotalsPanelProps): React.JSX.Element {
  const { open, width, onSetOpen, onRowHover, onRowClick, onRowContextMenu, cycleIndexByKey } =
    props

  const boq = useBoqLive()
  const totalPages = useViewerStore((s) => s.totalPages)
  const currentPage = useViewerStore((s) => s.currentPage)
  // Subscribe to the per-page slice via a STABLE reference: select the whole
  // record then read the bucket. Returning `[]` from the selector each render
  // would loop (Zustand sees a new identity every render). Stable EMPTY const
  // matches the same primitive-fallback discipline used by aggregateBoq's
  // useBoqLive (06-RESEARCH §2 line 240-243).
  const pageMarkupsRecord = useMarkupStore((s) => s.pageMarkups)
  const pageMarkups: Markup[] = pageMarkupsRecord[currentPage] ?? EMPTY_MARKUPS

  // Collapsed rail — slim column with expand chevron.
  if (!open) {
    return (
      <div
        data-testid="totals-panel-rail"
        style={{
          width: RAIL_WIDTH,
          flexShrink: 0,
          background: COLORS.dominant,
          borderLeft: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 8,
          transition: `width ${SPLITTER_ANIM_MS}ms ease-out`
        }}
      >
        <button
          type="button"
          aria-label="Expand Totals"
          onClick={() => onSetOpen(true)}
          style={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: COLORS.textPrimary,
            cursor: 'pointer',
            padding: 0
          }}
        >
          <ChevronLeft size={14} />
        </button>
      </div>
    )
  }

  // Empty-state decision tree (D-09 / UI-SPEC §"Empty States").
  let emptyMsg: string | null = null
  if (totalPages === 0) {
    emptyMsg = 'Open a PDF to begin.'
  } else if (boq.metadata.totalMarkups === 0) {
    emptyMsg = 'Place markups to see totals.'
  } else if (boq.categories.length === 0) {
    emptyMsg = 'Place markups on a calibrated page to see length and area totals.'
  }

  // Default no-op handlers when caller hasn't wired interactions yet (Plan 06-05 binds these).
  const handleRowHover = onRowHover ?? (() => {})
  const handleRowClick = onRowClick ?? (() => {})
  const handleRowContextMenu = onRowContextMenu ?? (() => {})

  return (
    <div
      data-testid="totals-panel"
      style={{
        width,
        flexShrink: 0,
        background: COLORS.dominant,
        borderLeft: `1px solid ${COLORS.border}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        transition: `width ${SPLITTER_ANIM_MS}ms ease-out`
      }}
    >
      {/* Top label + collapse-button row. */}
      <div
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.secondary,
          flexShrink: 0
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.textPrimary
          }}
        >
          Totals
        </span>
        <button
          type="button"
          aria-label="Collapse Totals"
          onClick={() => onSetOpen(false)}
          style={{
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: COLORS.textSecondary,
            cursor: 'pointer',
            padding: 0
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Metadata header — always renders, even in empty states. */}
      <TotalsPanelHeader boq={boq} />

      {/* Body — empty message or category list. */}
      {emptyMsg !== null ? (
        <div
          data-testid="totals-panel-empty-message"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 16px',
            fontSize: 13,
            fontWeight: 400,
            color: COLORS.textSecondary,
            textAlign: 'center'
          }}
        >
          {emptyMsg}
        </div>
      ) : (
        <div
          data-testid="totals-panel-categories"
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {boq.categories.map((cat) => (
            <TotalsCategoryBlock
              key={cat.name}
              category={cat}
              pageMarkups={pageMarkups}
              cycleIndexByKey={cycleIndexByKey}
              onRowHover={handleRowHover}
              onRowClick={handleRowClick}
              onRowContextMenu={handleRowContextMenu}
            />
          ))}
        </div>
      )}

      {/* Pinned grand-total bar (rendered only when there is a real BoqStructure to summarize). */}
      {emptyMsg === null && (
        <div
          data-testid="totals-panel-grand-total"
          style={{
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            background: COLORS.secondary,
            borderTop: `1px solid ${COLORS.border}`,
            flexShrink: 0
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: COLORS.textPrimary
            }}
          >
            Total
          </span>
          <span
            style={{
              display: 'flex',
              gap: 12,
              fontSize: 16,
              fontWeight: 600,
              color: COLORS.textPrimary,
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {boq.grandTotals.map((g) => (
              <span key={g.uom} data-testid="totals-panel-grand-total-entry">
                {g.total.toFixed(2)} {g.uom}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  )
}
