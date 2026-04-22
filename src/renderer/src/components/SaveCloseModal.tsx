import { useEffect, useRef } from 'react'
import { COLORS } from '../lib/constants'

export interface SaveCloseModalProps {
  filename: string
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

/**
 * D-16: Save / Discard / Cancel modal shown when the user tries to close the
 * window or open another file while there are unsaved changes.
 *
 * Save button is auto-focused (Escape triggers onCancel, Enter triggers onSave).
 * z-index 120 ensures this appears above all other recovery modals (zIndex 100).
 */
export function SaveCloseModal({
  filename,
  onSave,
  onDiscard,
  onCancel
}: SaveCloseModalProps): React.JSX.Element {
  const saveRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { saveRef.current?.focus() }, [])

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    if (e.key === 'Enter') { e.preventDefault(); onSave() }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120
      }}
      onKeyDown={handleKey}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Save changes before closing"
        style={{
          width: 420, padding: 20,
          background: COLORS.secondary,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', gap: 12,
          fontSize: 13, lineHeight: 1.45, color: COLORS.textPrimary
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>Unsaved changes</div>
        <div>Save changes to <strong>{filename}</strong>?</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              height: 28, padding: '4px 8px',
              background: 'transparent',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              color: COLORS.textPrimary, fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDiscard}
            style={{
              height: 28, padding: '4px 8px',
              background: 'transparent',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              color: COLORS.warning, fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Discard
          </button>
          <button
            ref={saveRef}
            type="button"
            onClick={onSave}
            style={{
              height: 28, padding: '4px 8px',
              background: COLORS.accent, border: 'none', borderRadius: 4,
              color: COLORS.textOnAccent, fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
