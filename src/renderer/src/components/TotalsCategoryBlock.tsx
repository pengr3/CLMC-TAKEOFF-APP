import { useState } from 'react'
import type React from 'react'
import { COLORS } from '../lib/constants'
import { useUiPanels } from '../hooks/useUiPanels'
import { TotalsRow } from './TotalsRow'
import type { BoqCategoryGroup, BoqItemRow, BoqRowType } from '../lib/boq-types'
import type { Markup, MarkupType } from '../types/markup'

/**
 * TotalsCategoryBlock — collapsible section in the TotalsPanel: heading row +
 * (when expanded) item rows + per-UoM subtotal rows.
 *
 * Heading discipline (D-06 / UI-SPEC §"Color"): NO color chip on heading.
 * Color is only on individual item rows (TotalsRow chip). The heading is just
 * a chevron + name.
 *
 * Collapse persistence: clicks on the heading toggle
 * `useUiPanels().collapsedCategories` which persists to localStorage under
 * `clmc.ui` (keyed by category display name). When the same project re-opens,
 * collapsed categories stay collapsed.
 *
 * Match resolution: `pageMarkups` is the current page's markup list. For each
 * row we filter to markups whose `name` matches the row's name-portion of the
 * label and whose `type` matches the row's underlying markup type
 * (perimeter-length / perimeter-area both map to underlying 'perimeter').
 * Filtering on the parent side keeps TotalsRow ignorant of stores.
 */
export interface TotalsCategoryBlockProps {
  category: BoqCategoryGroup
  /** Current page's markups — caller passes useMarkupStore.getMarkups(currentPage). */
  pageMarkups: Markup[]
  /** Cycle index lookup keyed by `${categoryName}|${itemLabel}`; absent → 0. */
  cycleIndexByKey?: Record<string, number>
  onRowHover: (matches: Markup[]) => void
  onRowClick: (item: BoqItemRow, categoryName: string) => void
  onRowContextMenu: (item: BoqItemRow, x: number, y: number) => void
}

/**
 * Map a BoqRowType (which carries both perimeter-length and perimeter-area)
 * back to the concrete underlying Markup.type used by the canvas store.
 */
function rowTypeToMarkupType(t: BoqRowType): MarkupType {
  if (t === 'perimeter-length' || t === 'perimeter-area') return 'perimeter'
  return t
}

/**
 * Strip the D-02 disambiguation suffix to recover the markup name.
 * Aggregator labels examples:
 *   "Outlet"             → "Outlet"
 *   "Outlet (count)"     → "Outlet"
 *   "Wall (linear)"      → "Wall"
 *   "Wall (perimeter)"   → "Wall"      (perimeter-length)
 *   "Wall (area)"        → "Wall"      (perimeter-area)
 */
function labelToName(label: string): string {
  return label.replace(/\s*\((count|linear|area|perimeter)\)\s*$/, '')
}

export function TotalsCategoryBlock(props: TotalsCategoryBlockProps): React.JSX.Element {
  const { category, pageMarkups, cycleIndexByKey, onRowHover, onRowClick, onRowContextMenu } = props
  const { collapsedCategories, toggleCategoryCollapsed } = useUiPanels()
  const [hoverHeading, setHoverHeading] = useState(false)

  const isCollapsed = collapsedCategories.includes(category.name)

  const matchesForRow = (row: BoqItemRow): Markup[] => {
    const name = labelToName(row.label)
    const underlying = rowTypeToMarkupType(row.type)
    return pageMarkups.filter((m) => m.name === name && m.type === underlying)
  }

  return (
    <div data-testid="totals-category-block" data-category-name={category.name}>
      {/* Heading row — chevron + name. No color chip (D-06). */}
      <div
        role="button"
        aria-expanded={!isCollapsed}
        aria-label={`Toggle category ${category.name}`}
        data-testid="totals-category-heading"
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
          data-testid="totals-category-chevron"
          style={{
            display: 'inline-block',
            width: 12,
            fontSize: 10,
            lineHeight: 1,
            opacity: 0.7
          }}
        >
          {isCollapsed ? '▸' : '▾'}
        </span>
        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {category.name}
        </span>
      </div>

      {/* Body — items + subtotals (hidden when collapsed). */}
      {!isCollapsed && (
        <>
          {category.items.map((item) => {
            const key = `${category.name}|${item.label}`
            const cycleIndex = cycleIndexByKey?.[key] ?? 0
            return (
              <TotalsRow
                key={item.label}
                item={item}
                cycleIndex={cycleIndex}
                currentPageMatches={matchesForRow(item)}
                onHover={onRowHover}
                onClick={(it) => onRowClick(it, category.name)}
                onContextMenu={(x, y) => onRowContextMenu(item, x, y)}
              />
            )
          })}

          {/* Subtotal rows — one per distinct UoM in this category (D-12). */}
          {category.subtotals.map((sub) => (
            <div
              key={sub.uom}
              role="row"
              data-testid="totals-subtotal-row"
              data-subtotal-uom={sub.uom}
              style={{
                height: 28,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '0 16px',
                background: COLORS.secondary,
                fontSize: 13,
                fontWeight: 400,
                color: COLORS.textPrimary,
                flexShrink: 0
              }}
            >
              {/* Empty cycle slot + empty chip slot to align with item rows. */}
              <div style={{ width: 6, flexShrink: 0 }} />
              <div style={{ width: 10, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>Subtotal</span>
              <span
                data-testid="totals-subtotal-quantity"
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 60,
                  textAlign: 'right',
                  flexShrink: 0
                }}
              >
                {sub.total.toFixed(2)}
              </span>
              <span
                style={{
                  width: 40,
                  textAlign: 'left',
                  color: COLORS.textSecondary,
                  flexShrink: 0
                }}
              >
                {sub.uom}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
