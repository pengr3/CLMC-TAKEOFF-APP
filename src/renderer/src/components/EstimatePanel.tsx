import { useEffect, useRef } from 'react'
import type React from 'react'
import { COLORS } from '../lib/constants'
import { CURRENCY_SYMBOL } from '../lib/currency'
import { DEFAULT_MARKUP_PCT } from '../lib/estimate-defaults'
import { useBoqLive } from '../hooks/useBoqLive'
import { useViewerStore } from '../stores/viewerStore'
import { useProjectStore } from '../stores/projectStore'
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
 *      Cost ₱ | Markup % · UNIT PRICE ₱ · TOTAL ₱ · Margin ₱ — a two-tier grouped
 *      header (10 columns; UAT 2026-07-01 added UNIT PRICE + renamed Price→TOTAL to
 *      match the export in commit af9a260).
 *   2. The empty-state decision tree adapted from TotalsPanel (open a PDF / place
 *      markups / calibrate a page).
 *   3. The category blocks in a scrollable body.
 *   4. A pinned grand-total bar with Cost/TOTAL/Margin off boq.grandTotal{Cost,
 *      Price,Margin} (each non-finite-guarded → ₱0.00). The UNIT PRICE slot is left
 *      BLANK on the grand total — a project-wide total has no single unit price
 *      (exactly like the export leaves col 8 blank on subtotal/grand rows).
 *
 * No arithmetic in the component — the aggregator is the single source of truth.
 */

// Shared grid template so header, rows, subtotals, and grand-total bar all align.
// 10 columns: Item · Qty · UoM · Material · Labor · Cost · Markup · UNIT PRICE ·
// TOTAL · Margin (UNIT PRICE added at position 8; UAT 2026-07-01).
const GRID_COLUMNS = 'minmax(120px, 1fr) 64px 48px 88px 88px 80px 72px 80px 80px 80px'

/** ₱ money cell — non-finite guard → ₱0.00. */
function formatMoney(n: number): string {
  const safe = Number.isFinite(n) ? n : 0
  return `${CURRENCY_SYMBOL}${safe.toFixed(2)}`
}

/**
 * DefaultMarkupControl — the project-wide default-markup editor in the Estimate
 * sheet header (WR-01). The default markup is PROJECT data (persists in the .clmc,
 * follows the project not the workstation), so it lives here at the top of the
 * Estimate sheet — NOT in the generic Settings ribbon tab (the inert Settings
 * control WR-01 flagged was removed).
 *
 * Reuses EstimateRow's CR-01-safe editable-cell recipe VERBATIM in spirit: the
 * input is UNCONTROLLED, driven by NATIVE blur/keydown listeners via a ref (NOT
 * React onChange/onBlur — React 19's value-tracker suppresses synthetic onChange
 * after a programmatic .value set + native 'input', and delegates blur as
 * 'focusout'). Commit is DEFERRED to blur + Enter only — NEVER the per-keystroke
 * 'input' event (CR-01/WR-02) — so typing a decimal like `27.5` is not written to
 * the store one partial parseFloat at a time. The store→field seed effect is
 * guarded on `document.activeElement !== el`, so a store write landing mid-typing
 * can't clobber the focused field back to its stored value. click/mousedown/keydown
 * stopPropagation so the control never bubbles to a parent handler. On commit:
 * parseFloat, NaN/empty → 0 and negative → 0, then setDefaultMarkupPct(parsed)
 * (which re-applies the same finite-≥0 coercion in the store).
 */
function DefaultMarkupControl(): React.JSX.Element {
  const defaultMarkupPct = useProjectStore((s) => s.defaultMarkupPct)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Commit: parseFloat, NaN/empty/negative → 0 (mirrors EstimateRow.commitMaterial;
  // the store action re-coerces finite-≥0). Read setDefaultMarkupPct via getState so
  // an injected spy would be honored (parallels EstimateRow's getState() commits).
  const commit = (text: string): void => {
    const parsed = parseFloat(text)
    const safe = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed
    useProjectStore.getState().setDefaultMarkupPct(safe)
  }

  // Seed effect — re-seed the DOM value from the store only when it differs AND the
  // cell is not the actively-focused element (CR-01). Guarding on activeElement !==
  // el makes this a no-op while the user edits (so `27.5` mid-typing is never
  // clobbered); the field re-syncs from the store on the next render after blur.
  useEffect(() => {
    const el = inputRef.current
    if (!el || document.activeElement === el) return
    const next = String(defaultMarkupPct)
    if (el.value !== next) el.value = next
  }, [defaultMarkupPct])

  // Native-listener effect: commit on blur + Enter keydown ONLY (never 'input'), and
  // stopPropagation on click/mousedown/keydown so the control never bubbles.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const onCommit = (): void => commit(el.value)
    const onKeyDown = (e: KeyboardEvent): void => {
      e.stopPropagation()
      if (e.key === 'Enter') commit(el.value)
    }
    const onStop = (e: Event): void => e.stopPropagation()
    el.addEventListener('blur', onCommit)
    el.addEventListener('keydown', onKeyDown)
    el.addEventListener('click', onStop)
    el.addEventListener('mousedown', onStop)
    return () => {
      el.removeEventListener('blur', onCommit)
      el.removeEventListener('keydown', onKeyDown)
      el.removeEventListener('click', onStop)
      el.removeEventListener('mousedown', onStop)
    }
    // commit closes over nothing store-keyed (reads/writes via getState); bind once.
  }, [])

  return (
    <div
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <label
        htmlFor="estimate-default-markup-input"
        style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary }}
      >
        Default markup:
      </label>
      <input
        ref={inputRef}
        id="estimate-default-markup-input"
        data-testid="estimate-default-markup-input"
        type="text"
        inputMode="decimal"
        aria-label="Project-wide default markup percent"
        defaultValue={String(defaultMarkupPct)}
        placeholder={String(DEFAULT_MARKUP_PCT)}
        style={{
          width: 56,
          height: 22,
          padding: '0 6px',
          background: COLORS.dominant,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 3,
          color: COLORS.textPrimary,
          fontSize: 12,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          outline: 'none'
        }}
      />
      <span style={{ fontSize: 12, color: COLORS.textSecondary }}>%</span>
    </div>
  )
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
      {/* Top label bar — the "Estimate" title plus the project-wide default-markup
          control (WR-01). The control sits ABOVE the column-header row; it is
          project-scoped (persists in the .clmc) and editable, so it belongs here on
          the Estimate sheet rather than the generic Settings ribbon tab. */}
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
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Estimate</span>
        <DefaultMarkupControl />
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
          <span style={{ gridColumn: '7 / 11', ...headerCellStyle }}>Client</span>
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
          <span style={headerNumStyle}>Unit Price {CURRENCY_SYMBOL}</span>
          <span style={headerNumStyle}>Total {CURRENCY_SYMBOL}</span>
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
          {/* Markup column — blank on the grand total. */}
          <span />
          {/* UNIT PRICE column — blank on the grand total (no single project-wide
              unit price; mirrors the export leaving col 8 blank). */}
          <span data-testid="estimate-grand-total-unit-price" />
          <span
            data-testid="estimate-grand-total-total"
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
