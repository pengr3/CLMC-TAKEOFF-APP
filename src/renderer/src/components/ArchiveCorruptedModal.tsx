import { useEffect, useRef } from 'react'
import { COLORS } from '../lib/constants'

export interface ArchiveCorruptedModalProps {
  onOpenAnyway: () => void
  onCancel: () => void
}

/**
 * D-07: shown when an opened .clmc archive's embedded plan.pdf SHA256 does not
 * match the sha256 stored in project.json. The user can [Open anyway] (markup
 * data may still be intact — markup positions are unaffected by PDF byte
 * changes if the PDF was simply re-saved) or [Cancel].
 */
export function ArchiveCorruptedModal({
  onOpenAnyway,
  onCancel
}: ArchiveCorruptedModalProps): React.JSX.Element {
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
        aria-label="Archive corruption warning"
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
        <div style={{ fontWeight: 600, fontSize: 14 }}>Archive may be corrupted</div>
        <div>
          The embedded PDF&apos;s checksum doesn&apos;t match the saved project.json.
          The file may have been modified outside the app or partially corrupted in transit.
          Open anyway to inspect — markup data may still be intact.
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
