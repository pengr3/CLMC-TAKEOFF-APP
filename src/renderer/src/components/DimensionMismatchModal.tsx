import { useEffect, useRef } from 'react'
import { COLORS } from '../lib/constants'

export interface DimensionMismatchModalProps {
  onOpenAnyway: () => void
  onCancel: () => void
}

export function DimensionMismatchModal({
  onOpenAnyway,
  onCancel
}: DimensionMismatchModalProps): React.JSX.Element {
  const openRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { openRef.current?.focus() }, [])

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel() }
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
        aria-label="PDF dimension warning"
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
        <div style={{ fontWeight: 600, fontSize: 14 }}>PDF dimensions changed</div>
        <div>
          PDF dimensions don&apos;t match the original. Markup positions may look wrong.
        </div>
        <div style={{ fontSize: 12, color: '#aaaaaa', fontStyle: 'italic' }}>
          Note: your scale calibration may need to be re-verified or reset after opening — different
          page sizes can change the pixels-per-millimeter ratio.
        </div>
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
            ref={openRef}
            type="button"
            onClick={onOpenAnyway}
            style={{
              height: 28, padding: '4px 8px',
              background: COLORS.accent, border: 'none', borderRadius: 4,
              color: COLORS.textOnAccent, fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Open anyway
          </button>
        </div>
      </div>
    </div>
  )
}
