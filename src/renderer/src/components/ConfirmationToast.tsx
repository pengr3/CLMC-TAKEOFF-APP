import { COLORS } from '../lib/constants'

export interface ConfirmationToastProps {
  ratioText: string
  onVerify: () => void
  onDismiss: () => void
}

/**
 * Persistent confirmation toast displayed after a successful scale calibration.
 *
 * Pure presentational component — NO auto-dismiss timer (setTimeout removed per MEDIUM #3 review).
 * Persistence is owned by the parent (CanvasViewport): dismissed on page change,
 * new calibration start, or explicit user action (Verify / Dismiss).
 */
export function ConfirmationToast({
  ratioText,
  onVerify,
  onDismiss
}: ConfirmationToastProps): React.JSX.Element {
  const linkButtonStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline'
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '8px 16px',
        background: COLORS.secondary,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 4,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        zIndex: 15,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        fontSize: 13,
        fontWeight: 400,
        color: COLORS.textPrimary,
        whiteSpace: 'nowrap'
      }}
    >
      <span>Scale set to {ratioText}. Verify by measuring a second line?</span>
      <button
        type="button"
        onClick={onVerify}
        style={{ ...linkButtonStyle, color: COLORS.accent }}
      >
        Verify
      </button>
      <button
        type="button"
        onClick={onDismiss}
        style={{ ...linkButtonStyle, color: COLORS.textSecondary }}
      >
        Dismiss
      </button>
    </div>
  )
}
