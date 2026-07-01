import { useEffect, useRef } from 'react'
import { COLORS } from '../lib/constants'
import { useDraggable } from '../hooks/useDraggable'

/**
 * Default copy for the file-OPEN failure case. Kept as the props default so
 * existing open-error callers render exactly as before (Phase 16 GAP-2 made this
 * modal reusable for export errors by parameterizing title/body — see below).
 */
export const OPEN_ERROR_TITLE = 'Failed to open file'
export const OPEN_ERROR_BODY =
  'An unexpected error occurred while opening the file. The file may be corrupted or inaccessible.'

export interface OpenErrorModalProps {
  message: string
  onClose: () => void
  /**
   * Heading copy. Defaults to the file-open failure title so existing callers are
   * unchanged; the export error path passes 'Export failed' (GAP-2).
   */
  title?: string
  /**
   * Body copy shown above the detail line. Defaults to the file-open failure body.
   * `message` (the specific reason from main) is always shown as the detail line
   * below this, regardless of title/body.
   */
  body?: string
}

export function OpenErrorModal({
  message,
  onClose,
  title = OPEN_ERROR_TITLE,
  body = OPEN_ERROR_BODY
}: OpenErrorModalProps): React.JSX.Element {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { closeRef.current?.focus() }, [])
  const { position, onPointerDown } = useDraggable()

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
        aria-label={title}
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
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        <div>{body}</div>
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
