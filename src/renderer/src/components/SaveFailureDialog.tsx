import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { COLORS } from '../lib/constants'
import type { SaveFailure } from '../stores/projectStore'

interface Props {
  failure: SaveFailure
  busy: boolean
  onRetry: () => void
  onSaveAs: () => void
  onClose: () => void
}

export function SaveFailureDialog({
  failure,
  busy,
  onRetry,
  onSaveAs,
  onClose
}: Props): React.JSX.Element {
  const overlay = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const retry = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const siblings = Array.from(document.body.children).filter(
      (el) => el !== overlay.current
    ) as HTMLElement[]
    const inert = siblings.map((el) => el.inert)
    siblings.forEach((el) => {
      el.inert = true
    })
    const containFocus = (event: FocusEvent): void => {
      if (!overlay.current?.contains(event.target as Node))
        (retry.current?.disabled ? dialog.current : retry.current)?.focus()
    }
    document.addEventListener('focusin', containFocus)
    retry.current?.focus()
    return () => {
      document.removeEventListener('focusin', containFocus)
      siblings.forEach((el, i) => {
        el.inert = inert[i]
      })
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  useEffect(() => {
    ;(busy ? dialog.current : retry.current)?.focus()
  }, [busy])
  const detail =
    failure.stage === 'backup'
      ? 'Could not preserve the previous saved version. The save was stopped. Try another location with Save As.'
      : failure.firstSave
        ? 'No project file was saved. Your changes are still open. Try another location with Save As.'
        : null
  const keyDown = (event: React.KeyboardEvent): void => {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      if (!busy) onClose()
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      const controls = Array.from(
        dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []
      )
      const index = controls.indexOf(document.activeElement as HTMLButtonElement)
      controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length]?.focus()
    }
  }
  const buttonStyle: React.CSSProperties = {
    minHeight: 28,
    padding: '4px 8px',
    borderRadius: 4,
    border: `1px solid ${COLORS.border}`,
    background: 'transparent',
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: 600
  }
  return createPortal(
    <div
      ref={overlay}
      onKeyDown={keyDown}
      onKeyUp={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onFocus={(event) => {
        if (event.target instanceof HTMLButtonElement) {
          event.target.style.outline = `2px solid ${COLORS.accent}`
          event.target.style.outlineOffset = '2px'
        }
      }}
      onBlur={(event) => { if (event.target instanceof HTMLButtonElement) event.target.style.outline = '' }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 140,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Could not save project"
        aria-describedby="save-failure-body"
        aria-busy={busy}
        tabIndex={-1}
        style={{
          width: 420,
          boxSizing: 'border-box',
          maxWidth: '100%',
          maxHeight: 'calc(100dvh - 48px)',
          overflowY: 'auto',
          overflowWrap: 'anywhere',
          padding: 16,
          borderRadius: 8,
          background: COLORS.secondary,
          border: `1px solid ${COLORS.border}`,
          color: COLORS.textPrimary,
          fontSize: 13,
          lineHeight: 1.5,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
        }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2, margin: '0 0 16px' }}>
          Could not save project
        </h2>
        <p id="save-failure-body">
          Your changes are still open. Close any app using this file and try again, or use Save As
          to choose another location.
        </p>
        {detail && <p>{detail}</p>}
        <p style={{ userSelect: 'text' }}>{failure.path}</p>
        <p style={{ userSelect: 'text', whiteSpace: 'pre-wrap' }}>{failure.message}</p>
        {busy && <p role="status">Saving…</p>}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 16
          }}
        >
          <button type="button" disabled={busy} style={buttonStyle} onClick={onClose}>
            Close
          </button>
          <button type="button" disabled={busy} style={buttonStyle} onClick={onSaveAs}>
            Save As
          </button>
          <button
            ref={retry}
            type="button"
            disabled={busy}
            style={{ ...buttonStyle, background: COLORS.accent, color: COLORS.textOnAccent }}
            onClick={onRetry}
          >
            Try Again
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
