import { useMemo, useState } from 'react'
import type React from 'react'
import { GripVertical, Lightbulb, LightbulbOff, Plus } from 'lucide-react'
import { COLORS } from '../lib/constants'
import type { BoqItemRow, BoqRowType } from '../lib/boq-types'
import type { Markup, MarkupType } from '../types/markup'
import { useViewerStore } from '../stores/viewerStore'
import { useMarkupStore } from '../stores/markupStore'
import { useProjectStore } from '../stores/projectStore'
import { InlineRenameInput } from './InlineRenameInput'

/**
 * TotalsRow — single BOQ item row in the right TotalsPanel.
 *
 * Layout (UI-SPEC §"TotalsRow" — fixed-width slots so cycle dot doesn't reflow):
 *   [cycle-dot 6px slot][lightbulb 16px][color chip 10x10][gap 4px][label flex:1][quantity right tabular-nums][gap 4px][uom 40px]
 *
 * Color discipline (D-06): chip ONLY on item-name cell. Heading rows, subtotals,
 * and the grand-total bar carry no color.
 *
 * Cycle navigation (D-10, plan 06-05): on click, the row navigates the viewer
 * to the next page in `pagesWithMatches` (sorted ascending) and fires
 * `onTriggerPulse(matches, color)` so the parent can flash a PulseHighlight
 * over each matching markup on the destination page. Internal `cycleIndex`
 * tracks the next slot in `pagesWithMatches`; mouse-leave resets it (D-10
 * "until row-leave or category-collapse"). The row also retains the legacy
 * `onClick(item)` callback for callers who want to observe clicks externally.
 *
 * Hover (D-11): mouse-enter calls `onHover(currentPageMatches)` with the
 * caller-resolved current-page matches; mouse-leave calls `onHover([])`.
 * Hover never navigates pages.
 *
 * Right-click (D-14): contextmenu fires `onContextMenu(x, y)`; the parent
 * mounts `TotalsRowContextMenu` at the cursor position.
 *
 * Visibility key (name-collision fix): the hidden-item key is the composite
 * string `name|categoryId` (not bare name). This ensures that two items
 * sharing the same name but belonging to different categories are toggled
 * independently. The same composite key is used by all markup renderers.
 */
export interface TotalsRowProps {
  item: BoqItemRow
  /** 0 → no cycle indicator; >0 (legacy parent-driven) → leading accent dot in fixed-width slot.
   *  When the row owns its own internal cycle (default), the dot is driven by internal state
   *  and this prop is treated as a starting nudge only. */
  cycleIndex: number
  /** Pre-resolved current-page matches (caller filters BoqStructure → Markup[]). */
  currentPageMatches: Markup[]
  onHover: (matches: Markup[]) => void
  /** Legacy "click observed" callback. The actual page navigation is done internally. */
  onClick: (item: BoqItemRow) => void
  onContextMenu: (x: number, y: number) => void
  /** Fired after a click navigates to a new page — caller can flash PulseHighlight. */
  onTriggerPulse?: (matches: Markup[], color: string) => void
  /** Arm the matching markup tool with this item's name/type/color. Fired on every row click. */
  onArmTool?: (item: BoqItemRow) => void
  /**
   * Phase 17 (D-09): grip pointerdown → drag-reorder lifecycle. The category block binds
   * `getRowRects` and passes this down so the drag starts ONLY from the grip. `itemKey` is
   * the row's `name|type` bucket key.
   */
  onGripPointerDown?: (e: React.PointerEvent, itemKey: string) => void
  /** Phase 17 (D-02): this row's inline rename editor is open (block/panel owns which row). */
  isRenaming?: boolean
  /** Phase 17 (D-02): open the inline rename editor for this row (double-click / menu Rename). */
  onStartRename?: () => void
  /** Phase 17 (D-02): the inline editor closed (committed / cancelled / collision-free). */
  onEndRename?: () => void
}

function formatQuantity(item: BoqItemRow): string {
  if (item.type === 'count') return String(Math.round(item.quantity))
  return item.quantity.toFixed(2)
}

/** D-02 disambiguation suffix stripper. "Outlet (count)" → "Outlet". */
export function labelToName(label: string): string {
  return label.replace(/\s*\((count|linear|area|perimeter|wall)\)\s*$/, '')
}

/**
 * MD-01: the identity of the inline-rename target, scoped by CATEGORY as well as
 * `name|type`. A single name-group can legitimately span two categories (Pitfall 3);
 * the bare `name|type` key is then the rowKey of two rows at once, so double-clicking
 * one would open BOTH editors. Prefixing the categoryId (empty/null → '__uncat__',
 * matching the aggregator's UNCAT bucket) makes each row's rename key unique so only
 * the row the user interacted with opens its editor. The value passed to renameGroup
 * is still the bare group name (labelToName) — renameGroup operates across all
 * categories, so its input is unchanged.
 */
export function renameKeyForItem(
  item: Pick<BoqItemRow, 'label' | 'type' | 'categoryId'>
): string {
  const catId = item.categoryId && item.categoryId.length > 0 ? item.categoryId : '__uncat__'
  return `${catId}::${labelToName(item.label)}|${item.type}`
}

/**
 * Map a BoqRowType back to the underlying Markup.type. Since Phase 15 the
 * perimeter row type equals the markup type ('perimeter'), so this is an
 * identity mapping — kept as a named seam for callsite clarity.
 */
export function rowTypeToMarkupType(t: BoqRowType): MarkupType {
  return t
}

/** Module-level helper: which markups on `pageMarkups` match (name, categoryId, rowType)? */
function matchMarkupsOnPage(
  pageMarkups: Markup[],
  itemName: string,
  categoryId: string | null,
  rowType: BoqRowType
): Markup[] {
  const underlying = rowTypeToMarkupType(rowType)
  return pageMarkups.filter((m) => {
    if (m.name !== itemName) return false
    if (m.type !== underlying) return false
    // Match by categoryId: null means uncategorized (empty string categoryId).
    const mCatId = m.categoryId && m.categoryId.length > 0 ? m.categoryId : null
    return mCatId === categoryId
  })
}

/** Module-level helper: which pages contain ≥1 matching markup, ascending? */
function findPagesWithMatches(
  pageMarkupsAll: Record<number, Markup[]>,
  itemName: string,
  categoryId: string | null,
  rowType: BoqRowType
): number[] {
  const out: number[] = []
  for (const [pageStr, list] of Object.entries(pageMarkupsAll)) {
    if (matchMarkupsOnPage(list, itemName, categoryId, rowType).length > 0) out.push(Number(pageStr))
  }
  return out.sort((a, b) => a - b)
}

export function TotalsRow(props: TotalsRowProps): React.JSX.Element {
  const {
    item, cycleIndex: cycleIndexProp, currentPageMatches, onHover, onClick, onContextMenu,
    onTriggerPulse, onArmTool, onGripPointerDown, isRenaming, onStartRename, onEndRename
  } = props
  const [bg, setBg] = useState<string>('transparent')

  // Internal cycle state. Reset on mouse-leave (D-10 "until row-leave").
  const [internalCycleIndex, setInternalCycleIndex] = useState(0)

  // Page navigation primitives — read directly from the stores so the row owns its own
  // cycle navigation lifecycle (no need for parent-side cycleIndexByKey orchestration).
  const setPage = useViewerStore((s) => s.setPage)
  const pageMarkupsAll = useMarkupStore((s) => s.pageMarkups)

  // Recompute pages-with-matches whenever the underlying markup store changes.
  const itemName = useMemo(() => labelToName(item.label), [item.label])

  // Composite visibility key: "name|categoryId" — prevents same-named items in
  // different categories from sharing a single hide/show toggle.
  const itemKey = useMemo(
    () => `${itemName}|${item.categoryId ?? ''}`,
    [itemName, item.categoryId]
  )

  const pagesWithMatches = useMemo(
    () => findPagesWithMatches(pageMarkupsAll, itemName, item.categoryId ?? null, item.type),
    [pageMarkupsAll, itemName, item.categoryId, item.type]
  )

  // O(1) Set lookup for hidden state — hiddenItemSet is derived from hiddenItemNames in projectStore.
  // Key is the composite `name|categoryId` string (not bare name) to avoid cross-category collision.
  const isHidden = useProjectStore((s) => s.hiddenItemSet.has(itemKey))

  // The dot is driven by either the parent's prop (legacy) OR the internal cycle state.
  const showCycleDot = internalCycleIndex > 0 || cycleIndexProp > 0

  const handleMouseEnter = (): void => {
    setBg(COLORS.hoverSurface)
    onHover(currentPageMatches)
  }
  const handleMouseLeave = (): void => {
    setBg('transparent')
    onHover([])
    // Reset internal cycle on row-leave (D-10).
    setInternalCycleIndex(0)
  }
  const handleMouseDown = (): void => {
    setBg(COLORS.activeSurface)
  }
  const handleMouseUp = (): void => {
    setBg(COLORS.hoverSurface)
  }
  const handleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    // D-02 (load-bearing perceived-perf): the SECOND click of a double-click (detail === 2)
    // must not cycle/arm — the double-click opens inline rename via onDoubleClick instead.
    // Only the redundant SECOND click is skipped; the FIRST click (detail 1) still fires
    // instantly, so the single-click cycle stays instant.
    if (e.detail === 2) return

    // Always notify the legacy click observer.
    onClick(item)

    // Cycle navigation: skip when no matches anywhere.
    // Arm fires even with no matches — new placements may land on any page.
    if (pagesWithMatches.length === 0) {
      onArmTool?.(item)
      return
    }

    const slot = internalCycleIndex % pagesWithMatches.length
    const targetPage = pagesWithMatches[slot]
    setPage(targetPage)
    const matchesOnTarget = matchMarkupsOnPage(
      pageMarkupsAll[targetPage] ?? [],
      itemName,
      item.categoryId ?? null,
      item.type
    )
    onTriggerPulse?.(matchesOnTarget, item.color ?? '#cccccc')

    // Advance cycle index (wraps via modulo on next click).
    setInternalCycleIndex((i) => (i + 1) % pagesWithMatches.length)

    // Arm the matching tool after cycle navigation.
    onArmTool?.(item)
  }
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault()
    onContextMenu(e.clientX, e.clientY)
  }

  return (
    <div
      role="row"
      aria-label={`${item.label} ${formatQuantity(item)} ${item.uom}`}
      data-testid="totals-row"
      data-item-label={item.label}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      style={{
        position: 'relative',
        height: 28,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 16px',
        background: bg,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 400,
        color: COLORS.textPrimary,
        flexShrink: 0
      }}
    >
      {/* Grip handle (D-09 / UI-SPEC §4) — absolutely positioned in the leading 16px gutter
           so it does NOT reflow row content. Hover-revealed (same bg !== 'transparent' gate as
           the Plus). Drag starts ONLY from here (onGripPointerDown preventDefaults + stops). */}
      <div
        role="button"
        aria-label={`Reorder ${itemName}`}
        data-testid="totals-row-grip"
        onPointerDown={(e) => onGripPointerDown?.(e, `${itemName}|${item.type}`)}
        // A stationary click on the grip (pointerdown without a drag) still synthesizes a
        // click event; pointerdown's stopPropagation does NOT suppress it, so without this
        // the click bubbles to the row's onClick → cycle-nav + arm-tool fire. Mirrors the
        // lightbulb's onClick stopPropagation (Pitfall 9).
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: 1,
          top: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          cursor: 'grab'
        }}
      >
        {bg !== 'transparent' && <GripVertical size={14} color={COLORS.textSecondary} />}
      </div>

      {/* Cycle dot — fixed 6px slot so absence/presence doesn't reflow the row */}
      <div
        style={{
          width: 6,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {showCycleDot && (
          <div
            data-testid="totals-row-cycle-dot"
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: COLORS.accent
            }}
          />
        )}
      </div>

      {/* Lightbulb visibility slot — 16px fixed width, always visible (D-14).
           Click toggles item visibility via O(1) hiddenItemSet + e.stopPropagation()
           prevents row cycle navigation from also firing (Pitfall 9 / T-08-06-01).
           Uses composite key `name|categoryId` to avoid cross-category collision. */}
      <div
        data-testid="totals-row-lightbulb"
        style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); useProjectStore.getState().toggleHiddenItem(itemKey) }}
        title={isHidden ? 'Show on canvas' : 'Hide from canvas'}
      >
        {isHidden
          ? <LightbulbOff size={12} color={COLORS.textSecondary} />
          : <Lightbulb size={12} color={COLORS.textSecondary} />
        }
      </div>

      {/* Per-name color chip (D-06 — only on item-name cell). */}
      <div
        data-testid="totals-row-color-chip"
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: item.color ?? 'transparent',
          border: item.color ? 'none' : `1px solid ${COLORS.border}`,
          flexShrink: 0
        }}
      />

      {/* Item label — flex:1 so quantity stays right-aligned. Double-click opens the inline
           rename editor (D-02); when editing, the input replaces the label text in place
           (chip / quantity / uom stay put). */}
      {isRenaming ? (
        <span style={{ flex: 1, minWidth: 0 }}>
          <InlineRenameInput currentName={itemName} onDone={onEndRename ?? (() => {})} />
        </span>
      ) : (
        <span
          data-testid="totals-row-label"
          onDoubleClick={() => onStartRename?.()}
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {item.label}
        </span>
      )}

      {/* Quantity — right-aligned, tabular-nums for column alignment. */}
      <span
        data-testid="totals-row-quantity"
        style={{
          fontVariantNumeric: 'tabular-nums',
          minWidth: 60,
          textAlign: 'right',
          flexShrink: 0
        }}
      >
        {formatQuantity(item)}
      </span>

      {/* UoM — fixed-width column. */}
      <span
        style={{
          width: 40,
          textAlign: 'left',
          color: COLORS.textSecondary,
          flexShrink: 0
        }}
      >
        {item.uom}
      </span>

      {/* Plus arm-tool affordance — fixed 20px slot so UoM column never reflows.
           Icon appears only while hovered; no own click handler (propagates to row). */}
      <div
        style={{ width: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        title="Add more to this group"
      >
        {bg !== 'transparent' && <Plus size={14} color={COLORS.textSecondary} />}
      </div>
    </div>
  )
}
