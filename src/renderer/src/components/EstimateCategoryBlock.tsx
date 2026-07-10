import { Fragment, useRef, useState } from 'react'
import type React from 'react'
import { COLORS } from '../lib/constants'
import { CURRENCY_SYMBOL } from '../lib/currency'
import { useUiPanels } from '../hooks/useUiPanels'
import { useRowReorder, type RowRect } from '../hooks/useRowReorder'
import { EstimateRow } from './EstimateRow'
import { labelToName } from './TotalsRow'
import type { BoqCategoryGroup, BoqItemRow } from '../lib/boq-types'

/**
 * EstimateCategoryBlock — a collapsible category section in the Estimate grid
 * (Phase 16, D-07). Analog: TotalsCategoryBlock (heading + collapse), but maps
 * items to EstimateRow (a spreadsheet row) and drops all the navigator machinery
 * (matchesForRow / onRowHover / onRowClick / onArmTool) — the Estimate grid is a
 * pricing sheet, not a canvas navigator.
 *
 * Collapse state reuses the SAME useUiPanels().collapsedCategories keyed by
 * category name as the totals panel — "preferences follow the workstation", so a
 * category collapsed in one view is collapsed in the other.
 *
 * After the item rows, the per-category subtotal cells (Cost/TOTAL/Margin) read
 * category.costSubtotal / priceSubtotal / marginSubtotal directly (aggregator-
 * computed; non-finite guarded → ₱0.00). No arithmetic in the component. The
 * UNIT PRICE column (UAT 2026-07-01) is left BLANK on the subtotal — a category
 * subtotal has no single unit price, exactly as the export leaves col 8 blank; and
 * "Price" was renamed to "TOTAL" to match the export (commit af9a260).
 */
export interface EstimateCategoryBlockProps {
  category: BoqCategoryGroup
  /** Phase 17 (D-01): route a row right-click up to the panel to open the shared group menu. */
  onContextMenu?: (item: BoqItemRow, x: number, y: number) => void
  /** Phase 17 (D-02): the `name|type` key of the row whose inline rename editor is open, or null. */
  renamingKey?: string | null
  /** Phase 17 (D-02): open the inline rename editor for the row with this `name|type` key. */
  onStartRename?: (key: string) => void
  /** Phase 17 (D-02): the inline editor closed (committed / cancelled / collision-free). */
  onEndRename?: () => void
}

/** ₱ money cell — non-finite guard → ₱0.00. */
function formatMoney(n: number): string {
  const safe = Number.isFinite(n) ? n : 0
  return `${CURRENCY_SYMBOL}${safe.toFixed(2)}`
}

export function EstimateCategoryBlock(props: EstimateCategoryBlockProps): React.JSX.Element {
  const { category, onContextMenu, renamingKey, onStartRename, onEndRename } = props
  const { collapsedCategories, toggleCategoryCollapsed } = useUiPanels()
  const [hoverHeading, setHoverHeading] = useState(false)

  const isCollapsed = collapsedCategories.includes(category.name)

  // Phase 17 (D-09/D-10/D-11): within-category drag-reorder — the SAME wiring as
  // TotalsCategoryBlock (both surfaces share useRowReorder so they never diverge).
  // `catKey` is the aggregator's order-map key (categoryId | '__uncat__'); `orderedKeys`
  // are the `name|type` bucket keys in visual order — both match reorderItems + the
  // aggregator rank sort exactly.
  const catKey = category.items[0]?.categoryId ?? '__uncat__'
  const orderedKeys = category.items.map((i) => `${labelToName(i.label)}|${i.type}`)
  const { onGripPointerDown: startGripDrag, liftedKey, insertionIndex } = useRowReorder(
    catKey,
    orderedKeys
  )

  // Live row midpoints for the drop-index math — read from the real DOM each move (Pitfall 5)
  // so a mid-drag scroll keeps the drop index correct. Rows are in visual (= orderedKeys) order.
  const bodyRef = useRef<HTMLDivElement>(null)
  const getRowRects = (): RowRect[] => {
    const container = bodyRef.current
    if (!container) return []
    const rowEls = Array.from(container.querySelectorAll('[data-testid="estimate-row"]'))
    return rowEls.map((el, i) => {
      const rect = el.getBoundingClientRect()
      return { key: orderedKeys[i], mid: rect.top + rect.height / 2 }
    })
  }

  // 2px accent insertion line (UI-SPEC §4) — rendered at the drop boundary, inset 16px to
  // match the dense grid's padding, pointer-events off so it never intercepts the drag.
  const insertionLine = (
    <div
      data-testid="estimate-insertion-line"
      style={{
        height: 2,
        background: COLORS.accent,
        borderRadius: 1,
        margin: '0 16px',
        pointerEvents: 'none'
      }}
    />
  )

  return (
    <div data-testid="estimate-category-block" data-category-name={category.name}>
      {/* Heading row — chevron + name. No color chip (mirrors TotalsCategoryBlock). */}
      <div
        role="button"
        aria-expanded={!isCollapsed}
        aria-label={`Toggle category ${category.name}`}
        data-testid="estimate-category-heading"
        onClick={() => toggleCategoryCollapsed(category.name)}
        onMouseEnter={() => setHoverHeading(true)}
        onMouseLeave={() => setHoverHeading(false)}
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 16px',
          background: hoverHeading ? COLORS.hoverSurface : 'transparent',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          color: COLORS.textPrimary,
          userSelect: 'none',
          flexShrink: 0
        }}
      >
        <span
          aria-hidden="true"
          data-testid="estimate-category-chevron"
          style={{ display: 'inline-block', width: 12, fontSize: 10, lineHeight: 1, opacity: 0.7 }}
        >
          {isCollapsed ? '▸' : '▾'}
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {category.name}
        </span>
      </div>

      {/* Body — item rows + the three subtotals (hidden when collapsed). Rows keyed by the
          stable `name|type` bucket key (not item.label) so a reorder never flickers a
          neighbor's collision suffix (RESEARCH Open-Q 2). The bodyRef wraps ONLY the item
          rows so getRowRects's `estimate-row` query is scoped past the subtotal row. */}
      {!isCollapsed && (
        <>
          <div ref={bodyRef} data-testid="estimate-category-body">
            {category.items.map((item, rowIndex) => {
              const rowKey = orderedKeys[rowIndex]
              const isLifted = liftedKey === rowKey
              return (
                <Fragment key={rowKey}>
                  {insertionIndex === rowIndex && insertionLine}
                  <div
                    style={
                      isLifted
                        ? {
                            background: COLORS.activeSurface,
                            opacity: 0.9,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                            borderRadius: 4
                          }
                        : undefined
                    }
                  >
                    <EstimateRow
                      item={item}
                      onContextMenu={onContextMenu}
                      onGripPointerDown={(e, itemKey) => startGripDrag(e, itemKey, getRowRects)}
                      isRenaming={renamingKey === rowKey}
                      onStartRename={() => onStartRename?.(rowKey)}
                      onEndRename={onEndRename}
                    />
                  </div>
                </Fragment>
              )
            })}
            {insertionIndex === category.items.length && insertionLine}
          </div>

          {/* Per-category Cost/TOTAL/Margin subtotals — aggregator-computed, in a
              bold row aligned under the money columns. Uses the same 10-column grid
              template as EstimateRow so the values line up under Cost/TOTAL/Margin;
              the Markup and UNIT PRICE columns are blank (a subtotal has no single
              unit price or markup). */}
          <div
            data-testid="estimate-category-subtotal"
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(120px, 1fr) 64px 48px 88px 88px 80px 72px 80px 80px 80px',
              alignItems: 'center',
              gap: 8,
              height: 28,
              padding: '0 16px',
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.textPrimary,
              borderTop: `1px solid ${COLORS.border}`,
              flexShrink: 0
            }}
          >
            {/* Label spans the first five columns (Item..Labor); empty spacers keep
                the money cells under their headers. */}
            <span style={{ gridColumn: '1 / 6', color: COLORS.textSecondary }}>Subtotal</span>
            <span
              data-testid="estimate-category-cost-subtotal"
              style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
            >
              {formatMoney(category.costSubtotal)}
            </span>
            {/* Markup column — blank on the subtotal. */}
            <span />
            {/* UNIT PRICE column — blank on the subtotal. */}
            <span data-testid="estimate-category-unit-price-subtotal" />
            <span
              data-testid="estimate-category-total-subtotal"
              style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
            >
              {formatMoney(category.priceSubtotal)}
            </span>
            <span
              data-testid="estimate-category-margin-subtotal"
              style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
            >
              {formatMoney(category.marginSubtotal)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
