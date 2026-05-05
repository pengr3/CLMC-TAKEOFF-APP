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
}

/**
 * Right-click context menu for a BOQ TotalsRow (D-14).
 * Modeled 1:1 on MarkupContextMenu (positioning, outside-click dismissal, Escape,
 * defer-listener-registration). Single action: "Copy as text".
 *
 * Clipboard payload (UI-SPEC §"Right-click an item row" — locked):
 *   - count           → `{label}\t{Math.round(quantity)}\t{uom}`
 *   - linear / area / perimeter-* → `{label}\t{quantity.toFixed(2)}\t{uom}`
 *
 * The payload is written via `navigator.clipboard.writeText`. On success the
 * caller fires "Copied {label}"; on failure the caller fires "Copy failed."
 * (warning-tinted) — the toast shape is owned by the parent (parent-owned-
 * lifecycle pattern from ConfirmationToast).
 */
export function TotalsRowContextMenu({
  screenPos,
  item,
  onClose,
  onCopy,
  onCopyError
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

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Item actions"
      style={{
        position: 'fixed',
        left: screenPos.x,
        top: screenPos.y,
        minWidth: 160,
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
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          // Fire-and-forget — the async handler resolves onCopy/onCopyError + onClose internally.
          void handleCopyAsText()
        }}
        style={{
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
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = COLORS.hoverSurface
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        Copy as text
      </button>
    </div>
  )
}
