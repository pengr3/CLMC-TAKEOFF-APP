import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { COLORS } from '../lib/constants'
import { useReleaseInfo } from '../hooks/useReleaseInfo'

export const NOTES_UNAVAILABLE =
  'Release notes are unavailable in this installation. Ask your internal maintainer for this version’s notes.'

export function AboutDialog({
  onClose,
  projectPath
}: {
  onClose: () => void
  projectPath: string | null
}): React.JSX.Element {
  const { info, loading } = useReleaseInfo()
  const overlay = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const siblings = Array.from(document.body.children).filter(
      (el) => el !== overlay.current
    ) as HTMLElement[]
    const inert = siblings.map((el) => el.inert)
    siblings.forEach((el) => {
      el.inert = true
    })
    const contain = (event: FocusEvent): void => {
      if (!overlay.current?.contains(event.target as Node)) close.current?.focus()
    }
    document.addEventListener('focusin', contain)
    close.current?.focus()
    return () => {
      document.removeEventListener('focusin', contain)
      siblings.forEach((el, i) => {
        el.inert = inert[i]
      })
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  return createPortal(
    <div
      ref={overlay}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
        if (event.key === 'Tab') {
          event.preventDefault()
          ;(document.activeElement === close.current ? scroll.current : close.current)?.focus()
        }
      }}
      onKeyUp={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        padding: 24,
        zIndex: 140,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)'
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-heading"
        data-release-ready={info?.releaseReady === true}
        style={{
          width: 640,
          maxWidth: '100%',
          maxHeight: 'calc(100dvh - 48px)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: 16,
          borderRadius: 8,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.secondary,
          color: COLORS.textPrimary,
          fontFamily: 'Inter, sans-serif',
          fontSize: 13,
          lineHeight: 1.5,
          overflowWrap: 'anywhere'
        }}
      >
        <h2
          id="about-heading"
          style={{
            margin: '0 0 8px',
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.2,
            flexShrink: 0
          }}
        >
          CLMC Takeoff
        </h2>
        <div role="status" style={{ marginBottom: 16, flexShrink: 0 }}>
          {loading
            ? 'Loading version…'
            : info?.version
              ? `Version ${info.version}`
              : 'Version unavailable'}
        </div>
        <div
          ref={scroll}
          data-testid="about-scroll-content"
          tabIndex={0}
          aria-label="Release information"
          style={{
            overflowY: 'auto',
            minHeight: 0,
            overscrollBehavior: 'contain',
            userSelect: 'text'
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2, marginBottom: 8 }}>Release Notes</h3>
          {loading ? (
            <p>Loading release notes…</p>
          ) : info?.notes && info.notesStatus === 'available' ? (
            <ul style={{ display: 'grid', gap: 8, paddingLeft: 16 }}>
              {info.notes.changes.map((change, index) => (
                <li key={index} style={{ whiteSpace: 'pre-wrap' }}>
                  {change}
                </li>
              ))}
            </ul>
          ) : (
            <p>{NOTES_UNAVAILABLE}</p>
          )}
          <h3 style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2, margin: '16px 0 8px' }}>Manual Updates</h3>
          <p>
            Updates are installed manually. Ask your internal maintainer for the approved installer.
          </p>
          <h3 style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2, margin: '16px 0 8px' }}>Project Compatibility</h3>
          <p>
            {info?.notes?.compatibility ??
              'Saving will use this version’s project format. Older versions may not preserve rate units correctly. Keep a separate pre-upgrade copy if you need to return to an older version.'}
          </p>
          <h3 style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2, margin: '16px 0 8px' }}>Backup and Recovery</h3>
          <p>
            After a successful replacement save, one last-good backup is kept beside the project as{' '}
            {'${project}.bak'} (for example, Estimate.clmc.bak). A first save does not create a
            previous-version backup.
          </p>
          {projectPath && (
            <p style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
              Backup location after a successful replacement save: {projectPath}.bak
            </p>
          )}
          <p style={{ marginTop: 8 }}>
            Use Open and select the adjacent .bak file in the native file picker to open a backup
            copy. Keep the original project; save the recovered work to a separate project file.
          </p>
          <p style={{ marginTop: 8 }}>
            Recovery copies protect periodic unsaved work and include the PDF. They cannot guarantee
            every latest edit or protect against loss of this computer or its drive. Keep separate
            copies of important projects before updating. Use More → Recover Unsaved Work when a
            recovery copy is available.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0, paddingTop: 16 }}>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            onFocus={(event) => {
              event.currentTarget.style.outline = `2px solid ${COLORS.accent}`
              event.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(event) => {
              event.currentTarget.style.outline = ''
            }}
            style={{
              minHeight: 28,
              borderRadius: 4,
              padding: '4px 8px',
              border: `1px solid ${COLORS.border}`,
              background: COLORS.accent,
              color: COLORS.textOnAccent,
              fontSize: 13,
              fontWeight: 600
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
