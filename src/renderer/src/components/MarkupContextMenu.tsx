import { useEffect, useRef } from 'react'
import { COLORS } from '../lib/constants'
import { MARKUP_PALETTE } from '../lib/markup-palette'

export interface MarkupContextMenuProps {
  screenPos: { x: number; y: number }
  currentColor: string
  onRecolor: (hex: string) => void
  onDelete: () => void
  onClose: () => void
}

/**
 * Right-click context menu for a committed markup.
 * Modeled on ScaleContextMenu (positioning, outside-click dismissal, Escape).
 * Row of palette swatches for recolor (D-28); separator; Delete item.
 *
 * The recolor callback writes through markupStore.recolorGroup(name, hex)
 * at the CanvasViewport callsite, so all markups in the name-group flip (D-29).
 */
export function MarkupContextMenu({
  screenPos,
  currentColor,
  onRecolor,
  onDelete,
  onClose
}: MarkupContextMenuProps): React.JSX.Element {
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

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Markup actions"
      style={{
        position: 'fixed',
        left: screenPos.x,
        top: screenPos.y,
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
      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary }}>
        Recolor group
      </div>
      <div
        role="radiogroup"
        aria-label="Color"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}
      >
        {MARKUP_PALETTE.map((hex) => {
          const isCurrent = hex === currentColor
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={isCurrent}
              aria-label={`Color ${hex}`}
              onClick={() => {
                onRecolor(hex)
                onClose()
              }}
              style={{
                width: 20,
                height: 20,
                padding: 0,
                borderRadius: 3,
                background: hex,
                border: isCurrent ? `2px solid ${COLORS.accent}` : `2px solid ${COLORS.border}`,
                boxShadow: isCurrent ? 'inset 0 0 0 2px #ffffff' : 'none',
                cursor: 'pointer'
              }}
            />
          )
        })}
      </div>
      <div style={{ height: 1, background: COLORS.border, margin: '4px 0' }} />
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onDelete()
          onClose()
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
        Delete
      </button>
    </div>
  )
}
