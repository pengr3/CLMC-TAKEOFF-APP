import { useEffect, useMemo, useRef } from 'react'
import type React from 'react'
import { COLORS } from '../lib/constants'
import { CURRENCY_SYMBOL } from '../lib/currency'
import { DEFAULT_MARKUP_PCT } from '../lib/estimate-defaults'
import { labelToName } from './TotalsRow'
import type { BoqItemRow } from '../lib/boq-types'
import { useProjectStore } from '../stores/projectStore'

/**
 * EstimateRow — one row of the full-width Estimate grid (Phase 16, D-07).
 *
 * Analog: TotalsRow's inline-edit recipe (TotalsRow.tsx:160-222), replicated
 * PER editable cell. Three editable cells — Material rate, Labor rate, Markup %
 * — plus read-only ₱ Cost / UNIT PRICE / TOTAL / Margin cells. Cost/TOTAL/Margin
 * come STRAIGHT from the aggregator-computed row (item.cost / item.price /
 * item.margin); UNIT PRICE is the per-unit client price (UAT 2026-07-01) computed
 * by the local unitPriceOf() helper (= (material+labor)×(1+markup/100) ==
 * item.price/quantity). TOTAL is the renamed "Price" cell — value unchanged
 * (item.price), only the header/testid changed. The component does NO row-total
 * arithmetic: the aggregator (boq-aggregator.ts) is the single source of truth for
 * Cost/TOTAL/Margin (mirrors the "no rate×quantity in TotalsRow" rule); unitPriceOf
 * only re-expresses the aggregator's price as a per-unit figure, and intentionally
 * duplicates the main-process writer helper across the process boundary (the
 * codebase's duplication-with-test-lock convention).
 *
 * Editable cells are UNCONTROLLED + driven by NATIVE blur/keydown listeners (NOT
 * React onChange/onBlur). Rationale (Phase 15, 16-RESEARCH Pitfall 3):
 * React 19's value-tracker suppresses synthetic onChange when a caller sets
 * `.value` then dispatches a native 'input' event, and React delegates blur as
 * 'focusout' — a raw 'blur' never reaches a synthetic onBlur. Native listeners
 * fire on exactly the events emitted, so a blur OR an Enter keydown reliably
 * commits. Commit is DEFERRED to blur/Enter — it is deliberately NOT bound to the
 * native 'input' event (CR-01/WR-02): 'input' fires per keystroke, which wrote a
 * partial parseFloat to the store every character (flipping isDirty on keystroke
 * 1, flickering wrong intermediate cost/price/margin) and, together with the seed
 * effect, clobbered decimals mid-typing ('0.' → stored 0 → field reset to ''). A
 * single commit on blur/Enter is the whole "change+blur OR Enter commits"
 * contract. Each cell also stopPropagation()s click/mousedown/keydown so the cell
 * never triggers a row-level handler — the grid is a spreadsheet, not a
 * navigator.
 *
 * Price key (16-RESEARCH Pitfall 4): `${labelToName(item.label)}|${item.type}` —
 * category-INDEPENDENT (reuses the exported labelToName to strip the disambiguation
 * suffix). The SAME key the aggregator reads; DISTINCT from the visibility
 * `name|categoryId` key. One PriceEntry feeds every category the item appears in.
 *
 * Commit rules (D-04 / Pitfall 5):
 *   - material/labor: parseFloat, NaN/negative → 0.
 *   - markup: blank/NaN → clear to DEFAULT_MARKUP_PCT (fall back to the 30% project
 *     default — NOT 0); a typed value → clamp ≥ 0.
 */
export interface EstimateRowProps {
  item: BoqItemRow
  /** Optional row-level click observer. In-cell interaction must NOT reach this
   *  (each cell stopPropagation()s) — the grid is a spreadsheet. */
  onRowClick?: (item: BoqItemRow) => void
}

/** Quantity display — count → rounded int, else 2dp (mirrors TotalsRow.formatQuantity). */
function formatQuantity(item: BoqItemRow): string {
  if (item.type === 'count') return String(Math.round(item.quantity))
  return item.quantity.toFixed(2)
}

/** ₱ money cell — non-finite guard → ₱0.00 (mirrors TotalsRow.formatCost). No arithmetic. */
function formatMoney(n: number): string {
  const safe = Number.isFinite(n) ? n : 0
  return `${CURRENCY_SYMBOL}${safe.toFixed(2)}`
}

/**
 * Per-UNIT client price for the Estimate grid's UNIT PRICE column (UAT 2026-07-01,
 * D-07). = (material + labor) × (1 + markup/100), which equals item.price / quantity
 * (so UNIT PRICE × qty === TOTAL) — but computed from the rates so it is qty-safe
 * (a zero-quantity row yields 0, not a division by zero). Non-finite inputs coerce
 * to 0 and the product itself is guarded, matching the other money cells' discipline.
 *
 * This DELIBERATELY duplicates the main-process writer helper of the same name in
 * src/main/boq-writers.ts across the process boundary — the codebase's established
 * "duplication-with-test-lock" convention (like NUMFMT_PESO vs currency.ts). Do NOT
 * import the main-process helper into the renderer.
 */
export function unitPriceOf(item: Pick<BoqItemRow, 'material' | 'labor' | 'markup'>): number {
  const material = Number.isFinite(item.material) ? item.material : 0
  const labor = Number.isFinite(item.labor) ? item.labor : 0
  const markup = Number.isFinite(item.markup) ? item.markup : 0
  const unit = (material + labor) * (1 + markup / 100)
  return Number.isFinite(unit) ? unit : 0
}

/** Seed a rate field from the stored value: non-positive/non-finite → empty
 *  (placeholder shows), matching TotalsRow.seedRateText. */
function seedRateText(r: number | undefined): string {
  return typeof r === 'number' && Number.isFinite(r) && r > 0 ? String(r) : ''
}

export function EstimateRow(props: EstimateRowProps): React.JSX.Element {
  const { item, onRowClick } = props

  // Category-INDEPENDENT price key `${name}|${type}` (Pitfall 4). Same key the
  // aggregator reads; strips the '(perimeter)'/'(count)' disambiguation suffix.
  const itemName = useMemo(() => labelToName(item.label), [item.label])
  const priceKey = useMemo(() => `${itemName}|${item.type}`, [itemName, item.type])

  // Current stored entry for this (name, type). Absent → undefined; material/labor
  // seed blank, markup seeds to the 30% default (Pitfall 5). Top-level selector.
  const entry = useProjectStore((s) => s.rates[priceKey])
  const material = entry?.material
  const labor = entry?.labor
  const markup = entry?.markup

  // One ref per editable cell — the fields are uncontrolled (native listeners below).
  const materialRef = useRef<HTMLInputElement | null>(null)
  const laborRef = useRef<HTMLInputElement | null>(null)
  const markupRef = useRef<HTMLInputElement | null>(null)

  // --- Commit functions (read via getState so an injected spy is honored) ---

  // material/labor: parseFloat, NaN/negative → 0 (mirrors TotalsRow.commitRate).
  const commitMaterial = (text: string): void => {
    const parsed = parseFloat(text)
    const safe = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed
    useProjectStore.getState().setPrice(priceKey, { material: safe })
  }
  const commitLabor = (text: string): void => {
    const parsed = parseFloat(text)
    const safe = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed
    useProjectStore.getState().setPrice(priceKey, { labor: safe })
  }
  // markup (Pitfall 5): blank/NaN → use the project default (30, NOT 0) so a
  // cleared field reverts to the default markup; a typed value → clamp ≥ 0.
  const commitMarkup = (text: string): void => {
    const parsed = parseFloat(text)
    if (Number.isNaN(parsed)) {
      useProjectStore.getState().setPrice(priceKey, { markup: DEFAULT_MARKUP_PCT })
      return
    }
    const safe = parsed < 0 ? 0 : parsed
    useProjectStore.getState().setPrice(priceKey, { markup: safe })
  }

  // --- Seed effects: re-seed the DOM value from the store only when it differs
  //     AND the cell is not the actively-focused element (CR-01/WR-02). Because
  //     commit is deferred to blur/Enter, the store value can only differ from a
  //     focused field mid-typing — re-seeding then would clobber the user's
  //     in-progress text (e.g. blank '0.' back to '' before they reach '0.5').
  //     Guarding on document.activeElement !== el makes the effect a no-op while
  //     the user edits; the field re-syncs from the store on the next render
  //     after it loses focus. Keyed on [priceKey, field]. ---
  useEffect(() => {
    const el = materialRef.current
    if (!el || document.activeElement === el) return
    const next = seedRateText(material)
    if (el.value !== next) el.value = next
  }, [priceKey, material])
  useEffect(() => {
    const el = laborRef.current
    if (!el || document.activeElement === el) return
    const next = seedRateText(labor)
    if (el.value !== next) el.value = next
  }, [priceKey, labor])
  useEffect(() => {
    const el = markupRef.current
    if (!el || document.activeElement === el) return
    // Unpriced row shows the 30% default (not blank) so the markup column always
    // reads a value (Pitfall 5). Only overwrite when the DOM differs.
    const next = markup !== undefined ? String(markup) : String(DEFAULT_MARKUP_PCT)
    if (el.value !== next) el.value = next
  }, [priceKey, markup])

  // --- Native-listener effects (one per cell): commit on blur, commit on Enter
  //     keydown, and stopPropagation on click/mousedown/keydown so the cell never
  //     bubbles to a row-level handler. Re-bound on [priceKey].
  //
  //     CR-01/WR-02: commit is bound to 'blur' + Enter ONLY — NOT the native
  //     'input' event. 'input' fires on every keystroke, so binding commit to it
  //     wrote a partial parseFloat to the store per character (flipping isDirty on
  //     the first keystroke, flickering wrong intermediate cost/price/margin
  //     through the live BOQ) and — combined with the seed effect — clobbered
  //     decimals mid-typing ('0.' → stored 0 → seed reset the field to ''). The
  //     component's documented contract is "change+blur OR Enter commits"; a
  //     single deferred commit satisfies it without per-keystroke store writes. ---
  useEffect(() => {
    const el = materialRef.current
    if (!el) return
    const onCommit = (): void => commitMaterial(el.value)
    const onKeyDown = (e: KeyboardEvent): void => {
      e.stopPropagation()
      if (e.key === 'Enter') commitMaterial(el.value)
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
    // commitMaterial closes over priceKey; re-bind when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceKey])
  useEffect(() => {
    const el = laborRef.current
    if (!el) return
    const onCommit = (): void => commitLabor(el.value)
    const onKeyDown = (e: KeyboardEvent): void => {
      e.stopPropagation()
      if (e.key === 'Enter') commitLabor(el.value)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceKey])
  useEffect(() => {
    const el = markupRef.current
    if (!el) return
    const onCommit = (): void => commitMarkup(el.value)
    const onKeyDown = (e: KeyboardEvent): void => {
      e.stopPropagation()
      if (e.key === 'Enter') commitMarkup(el.value)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceKey])

  // Markup shown in the read-only markup label / seed uses the same default.
  const markupDisplay = markup !== undefined ? markup : DEFAULT_MARKUP_PCT

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
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
  }

  // A prefixed ₱ cell wrapper for the editable rate cells (symbol + input).
  const renderRateCell = (
    ref: React.RefObject<HTMLInputElement | null>,
    testid: string,
    aria: string,
    seed: string
  ): React.JSX.Element => (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span aria-hidden="true" style={{ fontSize: 12, color: COLORS.textSecondary }}>
        {CURRENCY_SYMBOL}
      </span>
      <input
        ref={ref}
        data-testid={testid}
        type="text"
        inputMode="decimal"
        aria-label={aria}
        defaultValue={seed}
        placeholder="0.00"
        style={inputStyle}
      />
    </div>
  )

  return (
    <div
      role="row"
      data-testid="estimate-row"
      data-item-label={item.label}
      onClick={() => onRowClick?.(item)}
      style={{
        display: 'grid',
        gridTemplateColumns:
          'minmax(120px, 1fr) 64px 48px 88px 88px 80px 72px 80px 80px 80px',
        alignItems: 'center',
        gap: 8,
        height: 30,
        padding: '0 16px',
        fontSize: 13,
        color: COLORS.textPrimary,
        flexShrink: 0
      }}
    >
      {/* Item · Qty · UoM */}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.label}
      </span>
      <span
        style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: COLORS.textSecondary }}
      >
        {formatQuantity(item)}
      </span>
      <span style={{ textAlign: 'left', color: COLORS.textSecondary }}>{item.uom}</span>

      {/* Internal: Material ₱ (editable) · Labor ₱ (editable) · Cost ₱ (read-only) */}
      {renderRateCell(materialRef, 'estimate-row-material-input', `Material rate for ${itemName}`, seedRateText(material))}
      {renderRateCell(laborRef, 'estimate-row-labor-input', `Labor rate for ${itemName}`, seedRateText(labor))}
      <span
        data-testid="estimate-row-cost"
        style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
      >
        {formatMoney(item.cost)}
      </span>

      {/* Client: Markup % (editable) · UNIT PRICE ₱ (read-only) · TOTAL ₱ (read-only) ·
          Margin ₱ (read-only). UNIT PRICE (UAT 2026-07-01) is the per-unit client price
          = (material+labor)×(1+markup/100) == item.price/quantity — read-only/computed,
          NOT an editable input. TOTAL is the renamed "Price" cell (value stays item.price). */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={markupRef}
          data-testid="estimate-row-markup-input"
          type="text"
          inputMode="decimal"
          aria-label={`Markup percent for ${itemName}`}
          defaultValue={String(markupDisplay)}
          placeholder={String(DEFAULT_MARKUP_PCT)}
          style={inputStyle}
        />
        <span aria-hidden="true" style={{ fontSize: 12, color: COLORS.textSecondary }}>
          %
        </span>
      </div>
      <span
        data-testid="estimate-row-unit-price"
        style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
      >
        {formatMoney(unitPriceOf(item))}
      </span>
      <span
        data-testid="estimate-row-total"
        style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
      >
        {formatMoney(item.price)}
      </span>
      <span
        data-testid="estimate-row-margin"
        style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
      >
        {formatMoney(item.margin)}
      </span>
    </div>
  )
}
