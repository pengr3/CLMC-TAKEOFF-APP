import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { COLORS } from '../lib/constants'
import { useDraggable } from '../hooks/useDraggable'

export interface SaveCloseModalProps {
  filename: string
  busy?: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

/**
 * D-16: Save / Discard / Cancel modal shown when the user tries to close the
 * window or open another file while there are unsaved changes.
 *
 * Save is initially focused; Enter activates only its focused control.
 * z-index 120 ensures this appears above all other recovery modals (zIndex 100).
 */
export function SaveCloseModal({
  filename,
  busy = false,
  onSave,
  onDiscard,
  onCancel
}: SaveCloseModalProps): React.JSX.Element {
  const saveRef = useRef<HTMLButtonElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const contain = (event: FocusEvent): void => {
      if (!overlayRef.current?.contains(event.target as Node)) (saveRef.current?.disabled ? dialogRef.current : saveRef.current)?.focus()
    }
    document.addEventListener('focusin', contain)
    saveRef.current?.focus()
    return () => { document.removeEventListener('focusin', contain); if (previous?.isConnected) previous.focus() }
  }, [])
  const { position, onPointerDown } = useDraggable()

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    e.stopPropagation()
    if (e.key === 'Escape') { e.preventDefault(); if (!busy) onCancel() }
    if (e.key === 'Tab') {
      e.preventDefault()
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      const index = controls.indexOf(document.activeElement as HTMLButtonElement)
      controls[(index + (e.shiftKey ? controls.length - 1 : 1)) % controls.length]?.focus()
    }
  }

  return createPortal(
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120
      }}
      onKeyDown={handleKey}
      onKeyUp={event => event.stopPropagation()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Save changes before closing"
        onPointerDown={onPointerDown}
        style={{
          width: 420, maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100dvh - 48px)', overflowY: 'auto', overflowWrap: 'anywhere', padding: 20,
          background: COLORS.secondary,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', gap: 12,
          fontSize: 13, lineHeight: 1.45, color: COLORS.textPrimary,
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
        <div style={{ fontWeight: 600, fontSize: 14 }}>Unsaved changes</div>
        <div>Save changes to <strong>{filename}</strong>?</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            disabled={busy}
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
            disabled={busy}
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
            disabled={busy}
            ref={saveRef}
            type="button"
            onClick={onSave}
            style={{
              height: 28, padding: '4px 8px',
              background: COLORS.accent, border: 'none', borderRadius: 4,
              color: COLORS.textOnAccent, fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>, document.body
  )
}
