import { useEffect, useRef } from 'react'
import { COLORS } from '../lib/constants'

export interface UncalibratedExportWarningModalProps {
  uncalibratedPages: number[]
  onContinue: () => void
  onCancel: () => void
}

export function UncalibratedExportWarningModal({
  uncalibratedPages,
  onContinue,
  onCancel
}: UncalibratedExportWarningModalProps): React.JSX.Element {
  const continueRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { continueRef.current?.focus() }, [])

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  const word = uncalibratedPages.length === 1 ? 'Page' : 'Pages'
  const pageList = uncalibratedPages.join(', ')

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
        aria-label="Pages without scale"
        style={{
          width: 460, padding: 20,
          background: COLORS.secondary,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', gap: 12,
          fontSize: 13, lineHeight: 1.45, color: COLORS.textPrimary
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>Pages without scale</div>
        <div>
          {word} {pageList} have markups but no scale set. Their length, area,
          and perimeter measurements will be excluded from the export. Counts on
          those {word.toLowerCase()} export normally.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            aria-label="Cancel"
            onClick={onCancel}
            style={{
              height: 28, padding: '4px 8px',
              background: 'transparent',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              color: COLORS.textPrimary,
              fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.hoverSurface }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            Cancel
          </button>
          <button
            ref={continueRef}
            type="button"
            aria-label="Continue"
            onClick={onContinue}
            style={{
              height: 28, padding: '4px 8px',
              background: COLORS.accent, border: 'none', borderRadius: 4,
              color: COLORS.textOnAccent, fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.accentHover }}
            onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.accent }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
