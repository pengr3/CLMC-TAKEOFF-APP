import { COLORS } from '../lib/constants'

// Problem red — reuses the existing MARKUP_PALETTE[0] red-600 (UI-SPEC Color §).
// Defined as a named constant so the literal does not violate the "COLORS tokens
// only" rule; this red is the palette's problem color, not part of COLORS.
const PROBLEM_RED = '#dc2626'

export interface BlockedCommitMessageProps {
  /** Screen-space anchor (near the offending markup centroid). */
  anchor: { x: number; y: number }
  /** Optional dismiss callback. Parent owns the lifecycle — NO internal timer. */
  onDismiss?: () => void
}

/**
 * Blocked-commit message shown when an area/perimeter commit is refused because
 * its boundary self-intersects (D-09).
 *
 * Pure presentational component — NO auto-dismiss timer (mirrors ConfirmationToast,
 * which STATE.md records as pure presentational with no internal timer). The parent
 * (CanvasViewport) owns dismissal: it clears the message when the crossing is
 * resolved and the user re-commits, or on cancel/Esc.
 *
 * Surface style copied from ConfirmationToast / StatusBar (COLORS.secondary bg,
 * 1px COLORS.border, borderRadius 4, boxShadow, 13px text). The lead word
 * "Can't finish —" is rendered in problem red (#dc2626) weight 600.
 */
export function BlockedCommitMessage({
  anchor,
  onDismiss
}: BlockedCommitMessageProps): React.JSX.Element {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'absolute',
        left: anchor.x,
        top: anchor.y,
        transform: 'translateX(-50%)',
        maxWidth: 320,
        padding: '12px 16px',
        background: COLORS.secondary,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 4,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        zIndex: 16,
        fontSize: 13,
        fontWeight: 400,
        lineHeight: 1.4,
        color: COLORS.textPrimary
      }}
      onClick={onDismiss}
    >
      <span style={{ color: PROBLEM_RED, fontWeight: 600 }}>Can&apos;t finish —</span>{' '}
      A self-crossing shape would report a wrong area or perimeter. The crossing is
      highlighted in red — drag the corners or curve handle apart to fix it, then
      finish again.
    </div>
  )
}
