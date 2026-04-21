import { COLORS } from '../lib/constants'

export interface MarkupTooltipProps {
  screenPos: { x: number; y: number }
  text: string
}

/**
 * HTML tooltip absolutely-positioned over the canvas (D-33).
 * Pure presentational — parent (CanvasViewport) handles the 200ms show delay
 * and hide-on-mouseleave. Not interactive (pointer-events: none) so it never
 * steals hover from the underlying markup Group.
 */
export function MarkupTooltip({ screenPos, text }: MarkupTooltipProps): React.JSX.Element {
  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        left: screenPos.x + 12,
        top: screenPos.y + 12,
        padding: '4px 8px',
        background: COLORS.dominant,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 4,
        color: COLORS.textPrimary,
        fontSize: 13,
        fontFamily: 'Inter, sans-serif',
        lineHeight: 1.4,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        zIndex: 25
      }}
    >
      {text}
    </div>
  )
}
