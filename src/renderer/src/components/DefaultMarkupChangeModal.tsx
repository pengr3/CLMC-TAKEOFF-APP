import { useEffect, useRef } from 'react'
import { COLORS } from '../lib/constants'
import { useDraggable } from '../hooks/useDraggable'

export interface DefaultMarkupChangeModalProps {
  /** The currently-stored project default markup percent (before the pending change). */
  currentPct: number
  /** The pending value the user typed and is about to apply on confirm. */
  pendingPct: number
  /** Confirm — apply the pending value (caller writes setDefaultMarkupPct). */
  onConfirm: () => void
  /** Cancel — revert the input, no store write (also ESC / backdrop). */
  onCancel: () => void
}

/**
 * DefaultMarkupChangeModal — confirm-with-impact gate for the project-wide default
 * markup control (Estimate sheet header). The default markup re-prices EVERY item
 * that has no explicit per-item markup, so a change is significant despite committing
 * as quietly as a single rate cell. This dialog interposes between the input commit
 * and the store write: the store is only updated when the user confirms; Cancel (or
 * ESC / backdrop) reverts with no write.
 *
 * Matches the app's modal convention (SaveCloseModal / UncalibratedExportWarningModal):
 * centered, dark theme, fixed-overlay backdrop, draggable body, Cancel + accent-confirm
 * buttons, confirm button auto-focused, ESC = Cancel. The affected-row count is
 * intentionally OMITTED — it is not cleanly derivable from the data available in
 * EstimatePanel (BoqItemRow exposes a D-02-suffixed `label`, not the raw name needed to
 * key the rates map), and the plan forbids label-parsing or expanding the row type lock
 * to obtain it — so a clear scope statement is used instead.
 */
export function DefaultMarkupChangeModal({
  currentPct,
  pendingPct,
  onConfirm,
  onCancel
}: DefaultMarkupChangeModalProps): React.JSX.Element {
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    confirmRef.current?.focus()
  }, [])
  const { position, onPointerDown } = useDraggable()

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      onConfirm()
    }
  }

  // Backdrop click = Cancel; ignore clicks that originate inside the dialog body.
  const onBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onCancel()
  }

  return (
    <div
      data-testid="default-markup-change-modal"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 120
      }}
      onKeyDown={handleKey}
      onMouseDown={onBackdropMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Change default markup"
        onPointerDown={onPointerDown}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 420,
          padding: 20,
          background: COLORS.secondary,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          fontSize: 13,
          lineHeight: 1.45,
          color: COLORS.textPrimary,
          cursor: 'default',
          ...(position !== null
            ? {
                position: 'absolute' as const,
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`
              }
            : {})
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>Change default markup?</div>
        <div data-testid="default-markup-change-modal-body">
          This changes the project default markup from <strong>{currentPct}%</strong> to{' '}
          <strong>{pendingPct}%</strong> and re-prices every item that doesn&rsquo;t have its own
          markup.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            aria-label="Cancel"
            data-testid="default-markup-change-cancel"
            onClick={onCancel}
            style={{
              height: 28,
              padding: '4px 8px',
              background: 'transparent',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              color: COLORS.textPrimary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = COLORS.hoverSurface
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            aria-label="Change markup"
            data-testid="default-markup-change-confirm"
            onClick={onConfirm}
            style={{
              height: 28,
              padding: '4px 8px',
              background: COLORS.accent,
              border: 'none',
              borderRadius: 4,
              color: COLORS.textOnAccent,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = COLORS.accentHover
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = COLORS.accent
            }}
          >
            Change markup
          </button>
        </div>
      </div>
    </div>
  )
}
