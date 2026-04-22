import { useEffect, useRef } from 'react'
import { COLORS } from '../lib/constants'

export interface MissingPdfModalProps {
  expectedFilename: string
  originalPath: string
  onBrowse: () => void
  onCancel: () => void
}

export function MissingPdfModal({
  expectedFilename,
  originalPath,
  onBrowse,
  onCancel
}: MissingPdfModalProps): React.JSX.Element {
  const browseRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { browseRef.current?.focus() }, [])

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
        aria-label="PDF not found"
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
        <div style={{ fontWeight: 600, fontSize: 14 }}>PDF not found</div>
        <div>
          Couldn&apos;t find <strong>{expectedFilename}</strong>. Last seen at:
          <div style={{
            marginTop: 4, padding: 6,
            background: COLORS.dominant,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all'
          }}>
            {originalPath}
          </div>
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
            ref={browseRef}
            type="button"
            onClick={onBrowse}
            style={{
              height: 28, padding: '4px 8px',
              background: COLORS.accent, border: 'none', borderRadius: 4,
              color: COLORS.textOnAccent, fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Browse for PDF
          </button>
        </div>
      </div>
    </div>
  )
}
