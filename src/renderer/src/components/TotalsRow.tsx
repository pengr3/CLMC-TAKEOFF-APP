import { useState } from 'react'
import type React from 'react'
import { COLORS } from '../lib/constants'
import type { BoqItemRow } from '../lib/boq-types'
import type { Markup } from '../types/markup'

/**
 * TotalsRow — single BOQ item row in the right TotalsPanel.
 *
 * Layout (UI-SPEC §"TotalsRow" — fixed-width slots so cycle dot doesn't reflow):
 *   [cycle-dot 6px slot][color chip 10x10][gap 4px][label flex:1][quantity right tabular-nums][gap 4px][uom 40px]
 *
 * Color discipline (D-06): chip ONLY on item-name cell. Heading rows, subtotals,
 * and the grand-total bar carry no color.
 *
 * Event triplet pattern mirrored from CountPinMarkup.tsx:46-58 (Konva analog) —
 * here lifted into HTML: hover surface highlight on enter, cycle on click,
 * context menu on right-click. Plan 06-04 wires types/payloads only; the
 * concrete handlers (hover ring, pulse, navigation) come from App.tsx in
 * Plan 06-05.
 */
export interface TotalsRowProps {
  item: BoqItemRow
  /** 0 → no cycle indicator; >0 → leading accent dot in fixed-width slot. */
  cycleIndex: number
  /** Pre-resolved current-page matches (caller filters BoqStructure → Markup[]). */
  currentPageMatches: Markup[]
  onHover: (matches: Markup[]) => void
  onClick: (item: BoqItemRow) => void
  onContextMenu: (x: number, y: number) => void
}

function formatQuantity(item: BoqItemRow): string {
  if (item.type === 'count') return String(Math.round(item.quantity))
  return item.quantity.toFixed(2)
}

export function TotalsRow(props: TotalsRowProps): React.JSX.Element {
  const { item, cycleIndex, currentPageMatches, onHover, onClick, onContextMenu } = props
  const [bg, setBg] = useState<string>('transparent')

  const handleMouseEnter = (): void => {
    setBg(COLORS.hoverSurface)
    onHover(currentPageMatches)
  }
  const handleMouseLeave = (): void => {
    setBg('transparent')
    onHover([])
  }
  const handleMouseDown = (): void => {
    setBg(COLORS.activeSurface)
  }
  const handleMouseUp = (): void => {
    setBg(COLORS.hoverSurface)
  }
  const handleClick = (): void => {
    onClick(item)
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
        {cycleIndex > 0 && (
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

      {/* Item label — flex:1 so quantity stays right-aligned. */}
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {item.label}
      </span>

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
    </div>
  )
}
