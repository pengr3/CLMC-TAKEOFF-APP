import { Fragment, useRef, useState } from 'react'
import type React from 'react'
import { COLORS } from '../lib/constants'
import { useUiPanels } from '../hooks/useUiPanels'
import { useRowReorder, type RowRect } from '../hooks/useRowReorder'
import { TotalsRow, labelToName, rowTypeToMarkupType, renameKeyForItem } from './TotalsRow'
import type { BoqCategoryGroup, BoqItemRow } from '../lib/boq-types'
import type { Markup } from '../types/markup'

/**
 * TotalsCategoryBlock — collapsible section in the TotalsPanel: heading row +
 * (when expanded) item rows. Quantity-only (D-02): no ₱ cost subtotal.
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
 * label, whose `categoryId` matches the row's categoryId (name-collision fix),
 * and whose `type` matches the row's underlying markup type (since Phase 15 the
 * perimeter row type equals the underlying 'perimeter' markup type — one row).
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
  /** Phase 6 D-12: fired after row click navigates to page — triggers PulseHighlight. */
  onTriggerPulse?: (matches: Markup[], color: string) => void
  /** Phase 7.1: arms the matching markup tool with item name/category/color. */
  onArmTool?: (item: BoqItemRow, categoryName: string) => void
  /** Phase 17 (D-02): the `name|type` key of the row whose inline rename editor is open, or null. */
  renamingKey?: string | null
  /** Phase 17 (D-02): open the inline rename editor for the row with this `name|type` key. */
  onStartRename?: (key: string) => void
  /** Phase 17 (D-02): the inline editor closed (committed / cancelled / collision-free). */
  onEndRename?: () => void
}

export function TotalsCategoryBlock(props: TotalsCategoryBlockProps): React.JSX.Element {
  const {
    category, pageMarkups, cycleIndexByKey, onRowHover, onRowClick, onRowContextMenu,
    onTriggerPulse, onArmTool, renamingKey, onStartRename, onEndRename
  } = props
  const { collapsedCategories, toggleCategoryCollapsed } = useUiPanels()
  const [hoverHeading, setHoverHeading] = useState(false)

  const isCollapsed = collapsedCategories.includes(category.name)

  // Phase 17 (D-09/D-10/D-11): within-category drag-reorder. `catKey` is the aggregator's
  // order-map key (categoryId | '__uncat__'); `orderedKeys` are the `name|type` bucket keys
  // in current visual order — both match reorderItems + the aggregator rank sort exactly.
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
    const rowEls = Array.from(container.querySelectorAll('[data-testid="totals-row"]'))
    return rowEls.map((el, i) => {
      const rect = el.getBoundingClientRect()
      return { key: orderedKeys[i], mid: rect.top + rect.height / 2 }
    })
  }

  // 2px accent insertion line (UI-SPEC §4) — rendered at the drop boundary, inset 16px,
  // pointer-events off so it never intercepts the drag.
  const insertionLine = (
    <div
      data-testid="totals-insertion-line"
      style={{
        height: 2,
        background: COLORS.accent,
        borderRadius: 1,
        margin: '0 16px',
        pointerEvents: 'none'
      }}
    />
  )

  const matchesForRow = (row: BoqItemRow): Markup[] => {
    const name = labelToName(row.label)
    const underlying = rowTypeToMarkupType(row.type)
    return pageMarkups.filter((m) => {
      if (m.name !== name) return false
      if (m.type !== underlying) return false
      // Filter by categoryId to avoid cross-category collisions when items share a name.
      const mCatId = m.categoryId && m.categoryId.length > 0 ? m.categoryId : null
      return mCatId === (row.categoryId ?? null)
    })
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

      {/* Body — item rows only (hidden when collapsed). Quantity-only (D-02):
          the per-category ₱ cost subtotal was removed. Rows keyed by the stable
          `name|type` bucket key (not item.label) so a reorder never flickers a
          neighbor's collision suffix (RESEARCH Open-Q 2). */}
      {!isCollapsed && (
        <div ref={bodyRef} data-testid="totals-category-body">
          {category.items.map((item, rowIndex) => {
            const rowKey = orderedKeys[rowIndex]
            // MD-01: rename identity is category-scoped so a group spanning two categories
            // opens exactly ONE editor (rowKey stays `name|type` for drag/lift/React-key).
            const renameKey = renameKeyForItem(item)
            const cycleKey = `${category.name}|${item.label}`
            const cycleIndex = cycleIndexByKey?.[cycleKey] ?? 0
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
                  <TotalsRow
                    item={item}
                    cycleIndex={cycleIndex}
                    currentPageMatches={matchesForRow(item)}
                    onHover={onRowHover}
                    onClick={(it) => onRowClick(it, category.name)}
                    onContextMenu={(x, y) => onRowContextMenu(item, x, y)}
                    onTriggerPulse={onTriggerPulse}
                    onArmTool={onArmTool ? (it) => onArmTool(it, category.name) : undefined}
                    onGripPointerDown={(e, itemKey) => startGripDrag(e, itemKey, getRowRects)}
                    isRenaming={renamingKey === renameKey}
                    onStartRename={() => onStartRename?.(renameKey)}
                    onEndRename={onEndRename}
                  />
                </div>
              </Fragment>
            )
          })}
          {insertionIndex === category.items.length && insertionLine}
        </div>
      )}
    </div>
  )
}
