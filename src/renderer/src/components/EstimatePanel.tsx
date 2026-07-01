import type React from 'react'
import { COLORS } from '../lib/constants'
import { CURRENCY_SYMBOL } from '../lib/currency'
import { useBoqLive } from '../hooks/useBoqLive'
import { useViewerStore } from '../stores/viewerStore'
import { EstimateCategoryBlock } from './EstimateCategoryBlock'

/**
 * EstimatePanel — the full-width center-area Estimate sheet (Phase 16, D-01/D-07).
 *
 * Analog: TotalsPanel, but it FILLS the center area (flex:1, full width) instead
 * of the 320px right rail. Reads the widened BoqStructure from useBoqLive (live
 * for the PriceEntry map since 16-02/15-03), so editing a Material/Labor/Markup
 * cell recomputes Cost/Price/Margin + subtotals + grand totals instantly.
 *
 * Renders:
 *   1. A grouped column HEADER (net-new): Item · Qty · UoM | Material ₱ · Labor ₱ ·
 *      Cost ₱ | Markup % · Price ₱ · Margin ₱ — a two-tier grouped header.
 *   2. The empty-state decision tree adapted from TotalsPanel (open a PDF / place
 *      markups / calibrate a page).
 *   3. The category blocks in a scrollable body.
 *   4. A pinned grand-total bar with Cost/Price/Margin off boq.grandTotal{Cost,
 *      Price,Margin} (each non-finite-guarded → ₱0.00).
 *
 * No arithmetic in the component — the aggregator is the single source of truth.
 */

// Shared grid template so header, rows, subtotals, and grand-total bar all align.
const GRID_COLUMNS = 'minmax(120px, 1fr) 64px 48px 88px 88px 80px 72px 80px 80px'

/** ₱ money cell — non-finite guard → ₱0.00. */
function formatMoney(n: number): string {
  const safe = Number.isFinite(n) ? n : 0
  return `${CURRENCY_SYMBOL}${safe.toFixed(2)}`
}

export function EstimatePanel(): React.JSX.Element {
  const boq = useBoqLive()
  const totalPages = useViewerStore((s) => s.totalPages)

  // Empty-state decision tree (mirrors TotalsPanel :143-151).
  let emptyMsg: string | null = null
  if (totalPages === 0) {
    emptyMsg = 'Open a PDF to begin.'
  } else if (boq.metadata.totalMarkups === 0) {
    emptyMsg = 'Place markups to see totals.'
  } else if (boq.categories.length === 0) {
    emptyMsg = 'Place markups on a calibrated page to see length and area totals.'
  }

  const headerCellStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4
  }
  const headerNumStyle: React.CSSProperties = { ...headerCellStyle, textAlign: 'right' }

  return (
    <div
      data-testid="estimate-panel"
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: COLORS.dominant,
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Top label bar. */}
      <div
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.secondary,
          flexShrink: 0
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Estimate</span>
      </div>

      {/* Grouped column header — two-tier: group labels (Internal / Client) over the
          per-column labels, so the estimator reads which ₱ columns are internal cost
          vs. client-facing (D-07). */}
      <div style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.secondary, flexShrink: 0 }}>
        {/* Tier 1 — group spans. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_COLUMNS,
            gap: 8,
            padding: '4px 16px 0',
            alignItems: 'center'
          }}
        >
          <span style={{ gridColumn: '1 / 4', ...headerCellStyle }} />
          <span style={{ gridColumn: '4 / 7', ...headerCellStyle }}>Internal</span>
          <span style={{ gridColumn: '7 / 10', ...headerCellStyle }}>Client</span>
        </div>
        {/* Tier 2 — per-column labels. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_COLUMNS,
            gap: 8,
            padding: '2px 16px 6px',
            alignItems: 'center'
          }}
        >
          <span style={headerCellStyle}>Item</span>
          <span style={headerNumStyle}>Qty</span>
          <span style={headerCellStyle}>UoM</span>
          <span style={headerNumStyle}>Material {CURRENCY_SYMBOL}</span>
          <span style={headerNumStyle}>Labor {CURRENCY_SYMBOL}</span>
          <span style={headerNumStyle}>Cost {CURRENCY_SYMBOL}</span>
          <span style={headerNumStyle}>Markup %</span>
          <span style={headerNumStyle}>Price {CURRENCY_SYMBOL}</span>
          <span style={headerNumStyle}>Margin {CURRENCY_SYMBOL}</span>
        </div>
      </div>

      {/* Body — empty message or category list. */}
      {emptyMsg !== null ? (
        <div
          data-testid="estimate-panel-empty-message"
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
          data-testid="estimate-panel-categories"
          style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        >
          {boq.categories.map((cat) => (
            <EstimateCategoryBlock key={cat.name} category={cat} />
          ))}
        </div>
      )}

      {/* Pinned grand-total bar — Cost/Price/Margin off the aggregator. Shown once a
          PDF is open; suppressed in the pure no-project state (avoids stray ₱0.00). */}
      {totalPages > 0 && (
        <div
          data-testid="estimate-grand-total-bar"
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_COLUMNS,
            gap: 8,
            alignItems: 'center',
            height: 34,
            padding: '0 16px',
            borderTop: `1px solid ${COLORS.border}`,
            background: COLORS.secondary,
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.textPrimary,
            flexShrink: 0
          }}
        >
          <span style={{ gridColumn: '1 / 6' }}>Grand Total</span>
          <span
            data-testid="estimate-grand-total-cost"
            style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
          >
            {formatMoney(boq.grandTotalCost)}
          </span>
          <span />
          <span
            data-testid="estimate-grand-total-price"
            style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
          >
            {formatMoney(boq.grandTotalPrice)}
          </span>
          <span
            data-testid="estimate-grand-total-margin"
            style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
          >
            {formatMoney(boq.grandTotalMargin)}
          </span>
        </div>
      )}
    </div>
  )
}
