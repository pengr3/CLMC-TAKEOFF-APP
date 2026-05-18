import { useEffect, useRef } from 'react'
import { COLORS } from '../lib/constants'
import { useDraggable } from '../hooks/useDraggable'

export interface PageCountAbortModalProps {
  expectedPages: number
  actualPages: number
  onPickAgain: () => void
  onCancel: () => void
}

export function PageCountAbortModal({
  expectedPages,
  actualPages,
  onPickAgain,
  onCancel
}: PageCountAbortModalProps): React.JSX.Element {
  const pickRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { pickRef.current?.focus() }, [])
  const { position, onPointerDown } = useDraggable()

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
        aria-label="Page count mismatch — abort required"
        onPointerDown={onPointerDown}
        style={{
          width: 420, padding: 20,
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
        <div style={{ fontWeight: 600, fontSize: 14 }}>Wrong PDF</div>
        <div>
          Selected PDF has {actualPages} pages, but project expects {expectedPages}. This is probably a different file.
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
            ref={pickRef}
            type="button"
            onClick={onPickAgain}
            style={{
              height: 28, padding: '4px 8px',
              background: COLORS.accent, border: 'none', borderRadius: 4,
              color: COLORS.textOnAccent, fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Pick again
          </button>
        </div>
      </div>
    </div>
  )
}
