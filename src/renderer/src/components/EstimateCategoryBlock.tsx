import { useState } from 'react'
import type React from 'react'
import { COLORS } from '../lib/constants'
import { CURRENCY_SYMBOL } from '../lib/currency'
import { useUiPanels } from '../hooks/useUiPanels'
import { EstimateRow } from './EstimateRow'
import type { BoqCategoryGroup } from '../lib/boq-types'

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
}

/** ₱ money cell — non-finite guard → ₱0.00. */
function formatMoney(n: number): string {
  const safe = Number.isFinite(n) ? n : 0
  return `${CURRENCY_SYMBOL}${safe.toFixed(2)}`
}

export function EstimateCategoryBlock(props: EstimateCategoryBlockProps): React.JSX.Element {
  const { category } = props
  const { collapsedCategories, toggleCategoryCollapsed } = useUiPanels()
  const [hoverHeading, setHoverHeading] = useState(false)

  const isCollapsed = collapsedCategories.includes(category.name)

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

      {/* Body — item rows + the three subtotals (hidden when collapsed). */}
      {!isCollapsed && (
        <>
          {category.items.map((item) => (
            <EstimateRow key={item.label} item={item} />
          ))}

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
