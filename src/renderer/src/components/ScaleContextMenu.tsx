import { useEffect, useRef } from 'react'
import { COLORS } from '../lib/constants'

export interface ScaleContextMenuProps {
  screenPos: { x: number; y: number }
  onRecalibrate: () => void
  onVerify: () => void
  onClose: () => void
}

export function ScaleContextMenu({
  screenPos,
  onRecalibrate,
  onVerify,
  onClose
}: ScaleContextMenuProps): React.JSX.Element {
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
    // Defer listener registration so the triggering click doesn't immediately close the menu
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

  const itemStyle: React.CSSProperties = {
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

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Scale actions"
      style={{
        position: 'fixed',
        left: screenPos.x,
        top: screenPos.y,
        minWidth: 140,
        padding: 4,
        background: COLORS.secondary,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 4,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        fontSize: 13,
        color: COLORS.textPrimary
      }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => { onRecalibrate(); onClose() }}
        style={itemStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.hoverSurface }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        Recalibrate
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => { onVerify(); onClose() }}
        style={itemStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.hoverSurface }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        Verify scale
      </button>
    </div>
  )
}
