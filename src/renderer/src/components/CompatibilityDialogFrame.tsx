import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { COLORS } from '../lib/constants'

export function CompatibilityDialogFrame({
  title,
  busy,
  onCancel,
  children,
  footer
}: {
  title: string
  busy: boolean
  onCancel: () => void
  children: ReactNode
  footer: ReactNode
}): React.JSX.Element {
  const overlay = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const siblings = Array.from(document.body.children).filter(
      (el) => el !== overlay.current
    ) as HTMLElement[]
    const states = siblings.map((el) => el.inert)
    siblings.forEach((el) => {
      el.inert = true
    })
    const first = (): HTMLElement | null =>
      overlay.current?.querySelector<HTMLElement>('[data-initial-focus]:not(:disabled)') ??
      overlay.current?.querySelector<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), section'
      ) ??
      null
    const contain = (event: FocusEvent): void => {
      if (!overlay.current?.contains(event.target as Node)) first()?.focus()
    }
    document.addEventListener('focusin', contain)
    first()?.focus()
    return () => {
      document.removeEventListener('focusin', contain)
      siblings.forEach((el, i) => {
        el.inert = states[i]
      })
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  return createPortal(
    <div
      ref={overlay}
      onKeyUp={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') {
          e.preventDefault()
          if (!busy) onCancel()
        }
        if (e.key === 'Tab') {
          const controls = Array.from(
            overlay.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), [tabindex="0"]'
            ) ?? []
          )
          const at = controls.indexOf(document.activeElement as HTMLElement)
          if (
            !controls.length ||
            (e.shiftKey && at <= 0) ||
            (!e.shiftKey && (at < 0 || at === controls.length - 1))
          ) {
            e.preventDefault()
            controls[e.shiftKey ? controls.length - 1 : 0]?.focus()
          }
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        padding: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 150
      }}
    >
      <section
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-label={title}
        aria-busy={busy}
        style={{
          width: 'min(640px, calc(100vw - 48px))',
          maxHeight: 'calc(100vh - 48px)',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: 16,
          borderRadius: 8,
          background: COLORS.secondary,
          color: COLORS.textPrimary,
          border: `1px solid ${COLORS.border}`,
          fontSize: 13,
          lineHeight: 1.5,
          overflowWrap: 'anywhere'
        }}
      >
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h2>
        <div style={{ minHeight: 0, overflowY: 'auto' }}>{children}</div>
        <footer
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            flexWrap: 'wrap',
            flexShrink: 0
          }}
        >
          {footer}
        </footer>
      </section>
    </div>,
    document.body
  )
}
