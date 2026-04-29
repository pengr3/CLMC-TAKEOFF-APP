import { useEffect, useRef } from 'react'
import { COLORS } from '../lib/constants'

export interface OpenErrorModalProps {
  message: string
  onClose: () => void
}

export function OpenErrorModal({
  message,
  onClose
}: OpenErrorModalProps): React.JSX.Element {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { closeRef.current?.focus() }, [])

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
      }}
      onKeyDown={handleKey}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Failed to open file"
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
        <div style={{ fontWeight: 600, fontSize: 14 }}>Failed to open file</div>
        <div>
          An unexpected error occurred while opening the file. The file may be corrupted or inaccessible.
        </div>
        {message && (
          <div style={{
            padding: 6,
            background: COLORS.dominant,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all',
            color: COLORS.textSecondary
          }}>
            {message}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            style={{
              height: 28, padding: '4px 8px',
              background: COLORS.accent, border: 'none', borderRadius: 4,
              color: COLORS.textOnAccent, fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
