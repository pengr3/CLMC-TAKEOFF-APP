import React from 'react'
import { COLORS } from '../lib/constants'

/**
 * RibbonButton — Office-style ribbon button (D-16).
 *
 * 72×80px column-layout button with icon (20px) above an 11px label.
 * Distinct from IconButton (28px row-layout) used by the legacy Toolbar.
 *
 * Dimensions justification (per 09-04-PLAN.md task 1):
 *   icon(20) + gap(4) + label(11) + padding(8+8) ≈ 51px content
 *   → 80px height leaves 29px breathing room plus space for the 2px
 *     active indicator at the bottom without clipping.
 *
 * No Tailwind. No raw hex literals. Inline styles only — matches the
 * existing IconButton (Toolbar.tsx) and project convention.
 *
 * children slot accepts badge chips (chain-armed indicator) and chevron
 * elements (Set Scale dropdown) — same pattern as IconButton.
 */

export interface RibbonButtonProps {
  icon: React.ComponentType<{ size?: number; color?: string }>
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title?: string
  ariaLabel?: string
  onContextMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void
  children?: React.ReactNode
}

export function RibbonButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  disabled = false,
  title,
  ariaLabel,
  onContextMenu,
  children
}: RibbonButtonProps): React.JSX.Element {
  const baseBackground = active ? COLORS.activeSurface : 'transparent'
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onContextMenu={onContextMenu}
      title={title}
      aria-label={ariaLabel ?? title ?? label}
      aria-pressed={active}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        width: 72,
        height: 80,
        padding: '8px 4px',
        background: baseBackground,
        border: 'none',
        borderRadius: 4,
        borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
        color: COLORS.textPrimary,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        textAlign: 'center'
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) e.currentTarget.style.background = COLORS.hoverSurface
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = baseBackground
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.background = COLORS.activeSurface
      }}
      onMouseUp={(e) => {
        if (!disabled) e.currentTarget.style.background = active ? COLORS.activeSurface : COLORS.hoverSurface
      }}
    >
      <Icon size={20} color="currentColor" />
      <span
        style={{
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {label}
      </span>
      {children}
    </button>
  )
}
