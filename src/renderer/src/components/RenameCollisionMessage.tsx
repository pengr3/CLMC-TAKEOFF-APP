import type React from 'react'
import { COLORS } from '../lib/constants'

// Problem red — reuses the existing MARKUP_PALETTE[0] red-600 (UI-SPEC Color §).
// Defined as a named constant so the literal does not violate the "COLORS tokens
// only" rule; this red is the palette's problem color, not part of COLORS.
// Mirrors BlockedCommitMessage.tsx:6.
const PROBLEM_RED = '#dc2626'

export interface RenameCollisionMessageProps {
  /** The typed name that already belongs to another same-type group. */
  name: string
}

/**
 * Rename-collision block message (D-04). Shown beneath the InlineRenameInput when a
 * commit is refused because a same-type group already carries the typed name — the
 * rename store command returned `{ ok: false }` with zero writes.
 *
 * Pure presentational — NO auto-dismiss timer (mirrors BlockedCommitMessage /
 * ConfirmationToast, both "parent owns the lifecycle"). The parent (InlineRenameInput)
 * clears it when the user types again or presses Esc, and re-mounts it on the next
 * colliding commit.
 *
 * Surface modeled on BlockedCommitMessage (COLORS.secondary bg, 1px COLORS.border,
 * borderRadius 4, boxShadow, 13px text) but MORE compact per UI-SPEC §3 (padding
 * 8px 12px, maxWidth 260) since it sits inline under a dense list row. Positioned
 * absolutely directly beneath the input (marginTop 4) so it does NOT reflow the row
 * list. Text rendered in problem red (#dc2626) weight 600.
 */
export function RenameCollisionMessage({
  name
}: RenameCollisionMessageProps): React.JSX.Element {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'absolute',
        marginTop: 4,
        maxWidth: 260,
        padding: '8px 12px',
        background: COLORS.secondary,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 4,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        zIndex: 30,
        fontSize: 13,
        lineHeight: 1.4
      }}
    >
      <span style={{ color: PROBLEM_RED, fontWeight: 600 }}>
        {`A group named '${name}' already exists`}
      </span>
    </div>
  )
}
