import { useEffect, useRef } from 'react'
import type React from 'react'
import { COLORS } from '../lib/constants'
import type { BoqItemRow } from '../lib/boq-types'

export interface TotalsRowContextMenuProps {
  /** Cursor position in viewport coordinates (e.clientX/clientY at right-click). */
  screenPos: { x: number; y: number }
  /** The BOQ row whose context menu was opened. */
  item: BoqItemRow
  /** Outside-click / Escape / successful copy / failed copy → close. */
  onClose: () => void
  /** Fired on successful clipboard write. Caller wires to ConfirmationToast 'Copied {label}'. */
  onCopy: (confirmMsg: string) => void
  /** Fired on clipboard write failure. Caller wires to ConfirmationToast 'Copy failed.'. */
  onCopyError: () => void
  /** Phase 17 (D-01): open the inline rename editor for this group. */
  onRename?: () => void
  /** Phase 17 (D-01/D-06): open the Move-to-category dialog. */
  onMove?: () => void
  /** Phase 17 (D-01/D-07): open the Copy-to-category dialog. */
  onCopyTo?: () => void
  /** Phase 17 (D-01/D-08): duplicate the group in place (no dialog). */
  onDuplicate?: () => void
  /**
   * Phase 17 (D-01): render the totals-only "Copy as text" item below the separator.
   * The Estimate surface passes `false` — the four group actions are shared, the
   * clipboard copy is totals-only.
   */
  showCopyAsText?: boolean
}

/**
 * Shared group context menu for a BOQ row (D-01). Both surfaces (Totals panel and
 * Estimate sheet) render the SAME four group actions — Rename / Move to… / Copy to… /
 * Duplicate — above a separator; the totals-only "Copy as text" item sits below the
 * separator and is prop-gated by `showCopyAsText` (default true for the totals surface).
 *
 * Modeled 1:1 on MarkupContextMenu (positioning, outside-click dismissal, Escape,
 * defer-listener-registration, separator).
 *
 * "Copy as text" clipboard payload (UI-SPEC §"Right-click an item row" — locked):
 *   - count           → `{label}\t{Math.round(quantity)}\t{uom}`
 *   - linear / area / perimeter-* → `{label}\t{quantity.toFixed(2)}\t{uom}`
 *
 * The payload is written via `navigator.clipboard.writeText`. On success the caller
 * fires "Copied {label}"; on failure the caller fires "Copy failed." (warning-tinted).
 * The four group items dispatch their callback then close (parent owns the action).
 */
export function TotalsRowContextMenu({
  screenPos,
  item,
  onClose,
  onCopy,
  onCopyError,
  onRename,
  onMove,
  onCopyTo,
  onDuplicate,
  showCopyAsText = true
}: TotalsRowContextMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    // Defer listener registration so the triggering right-click doesn't immediately close the menu
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleCopyAsText = async (): Promise<void> => {
    const qtyStr =
      item.type === 'count' ? String(Math.round(item.quantity)) : item.quantity.toFixed(2)
    const payload = `${item.label}\t${qtyStr}\t${item.uom}`
    try {
      await navigator.clipboard.writeText(payload)
      onCopy(`Copied ${item.label}`)
    } catch {
      onCopyError()
    } finally {
      onClose()
    }
  }

  // Shared menu-item chrome (UI-SPEC §1). Kept as a plain style object (not a wrapper
  // component) so each item stays an inline <button role="menuitem"> — matching the
  // MarkupContextMenu / existing "Copy as text" recipe exactly.
  const menuItemStyle: React.CSSProperties = {
    width: '100%',
    height: 28,
    padding: '4px 8px',
    background: 'transparent',
    border: 'none',
    borderRadius: 4,
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: 400,
    textAlign: 'left',
    cursor: 'pointer'
  }
  const onItemEnter = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.currentTarget.style.background = COLORS.hoverSurface
  }
  const onItemLeave = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.currentTarget.style.background = 'transparent'
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Item actions"
      style={{
        position: 'fixed',
        left: screenPos.x,
        top: screenPos.y,
        // Widen 160→180 (UI-SPEC §1) so "Move to…" / "Copy to…" fit; matches MarkupContextMenu.
        minWidth: 180,
        padding: 8,
        background: COLORS.secondary,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 4,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 13,
        color: COLORS.textPrimary
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary }}>Item</div>

      {/* Four shared group actions (D-01), order locked to UI-SPEC §1.
          Ellipsis only on the two that open a dialog (Move to… / Copy to…). */}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onRename?.()
          onClose()
        }}
        style={menuItemStyle}
        onMouseEnter={onItemEnter}
        onMouseLeave={onItemLeave}
      >
        Rename
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onMove?.()
          onClose()
        }}
        style={menuItemStyle}
        onMouseEnter={onItemEnter}
        onMouseLeave={onItemLeave}
      >
        Move to…
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onCopyTo?.()
          onClose()
        }}
        style={menuItemStyle}
        onMouseEnter={onItemEnter}
        onMouseLeave={onItemLeave}
      >
        Copy to…
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onDuplicate?.()
          onClose()
        }}
        style={menuItemStyle}
        onMouseEnter={onItemEnter}
        onMouseLeave={onItemLeave}
      >
        Duplicate
      </button>

      {showCopyAsText && (
        <>
          <div style={{ height: 1, background: COLORS.border, margin: '4px 0' }} />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              // Fire-and-forget — the async handler resolves onCopy/onCopyError + onClose internally.
              void handleCopyAsText()
            }}
            style={menuItemStyle}
            onMouseEnter={onItemEnter}
            onMouseLeave={onItemLeave}
          >
            Copy as text
          </button>
        </>
      )}
    </div>
  )
}
