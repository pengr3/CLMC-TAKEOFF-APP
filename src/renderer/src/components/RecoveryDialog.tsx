import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RecoveryCandidate, RecoveryDeleteResult } from '../../../shared/reliability'
import { COLORS } from '../lib/constants'

interface Props {
  candidates: RecoveryCandidate[]
  busy: boolean
  error: string | null
  onKeep: () => void
  onRecover: (id: string) => void | Promise<void>
  onDiscard: (candidate: RecoveryCandidate) => Promise<RecoveryDeleteResult>
  onRetry: () => void | Promise<void>
}
const time = (value: string | number): string => new Date(value).toLocaleString()
function Details({ candidate: c }: { candidate: RecoveryCandidate }): React.JSX.Element {
  return (
    <div style={{ whiteSpace: 'pre-wrap', userSelect: 'text' }}>
      <strong>{c.sourcePath?.split(/[\\/]/).pop() ?? c.filename}</strong>
      <div>{c.sourcePath ? c.sourcePath : 'Not yet saved as a project'}</div>
      <div>Last recovery: {time(c.capturedAt)}</div>
      {c.sourcePath && (
        <div>Last project save: {c.lastSavedAt === null ? 'Unknown' : time(c.lastSavedAt)}</div>
      )}
    </div>
  )
}
export function RecoveryDialog(props: Props): React.JSX.Element | null {
  // Suppress a zero-candidate prompt, while allowing all hooks to live in the mounted decision.
  return props.candidates.length === 0 ? null : <RecoveryDecision {...props} />
}
function RecoveryDecision({
  candidates,
  busy,
  error,
  onKeep,
  onRecover,
  onDiscard,
  onRetry
}: Props): React.JSX.Element {
  const sorted = [...candidates].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
  const [selectedId, setSelectedId] = useState(sorted[0].id)
  const selected = sorted.find((c) => c.id === selectedId) ?? sorted[0]
  const [confirm, setConfirm] = useState(false)
  const [working, setWorking] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const recover = useRef<HTMLButtonElement>(null)
  const keep = useRef<HTMLButtonElement>(null)
  const keepCopy = useRef<HTMLButtonElement>(null)
  const operation = useRef(false)
  const blocked = busy || working
  const blockedRef = useRef(blocked)
  useEffect(() => {
    blockedRef.current = blocked
  }, [blocked])
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
      if (!overlay.current?.contains(event.target as Node))
        (keepCopy.current ?? (recover.current?.disabled ? keep.current : recover.current))?.focus()
    }
    document.addEventListener('focusin', contain)
    ;(recover.current?.disabled ? keep.current : recover.current)?.focus()
    return () => {
      document.removeEventListener('focusin', contain)
      siblings.forEach((el, index) => {
        el.inert = inert[index]
      })
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  useEffect(() => {
    if (confirm) keepCopy.current?.focus()
    else (recover.current?.disabled ? keep.current : recover.current)?.focus()
  }, [confirm])
  async function run(operationFn: () => void | Promise<void>): Promise<void> {
    if (operation.current || busy) return
    operation.current = true
    setWorking(true)
    try {
      await operationFn()
    } finally {
      operation.current = false
      setWorking(false)
    }
  }
  const problem = !selected.restorable
  const failure = localError ?? error
  const buttonStyle: React.CSSProperties = {
    minHeight: 28,
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 13,
    border: `1px solid ${COLORS.border}`,
    color: COLORS.textPrimary,
    background: COLORS.secondary
  }
  const focus = (event: React.FocusEvent<HTMLButtonElement>): void => {
    event.currentTarget.style.outline = `2px solid ${COLORS.accent}`
    event.currentTarget.style.outlineOffset = '2px'
  }
  return createPortal(
    <div
      ref={overlay}
      data-recovery-dialog
      onKeyUp={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          if (!blockedRef.current && !operation.current) {
            if (confirm) setConfirm(false)
            else onKeep()
          }
        }
        if (event.key === 'Tab') {
          const controls = Array.from(
            overlay.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), [tabindex="0"]'
            ) ?? []
          )
          if (!controls.length) {
            event.preventDefault()
            return
          }
          const index = controls.indexOf(document.activeElement as HTMLElement)
          if (
            (event.shiftKey && index <= 0) ||
            (!event.shiftKey && (index === controls.length - 1 || index < 0))
          ) {
            event.preventDefault()
            controls[event.shiftKey ? controls.length - 1 : 0].focus()
          }
        }
      }}
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
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-heading"
        aria-busy={blocked}
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
          id="recovery-heading"
          style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', flexShrink: 0 }}
        >
          {confirm ? 'Discard Recovery Copy' : 'Recover unsaved work?'}
        </h2>
        <div
          data-recovery-list
          style={{ minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}
        >
          {confirm ? (
            <>
              <p>
                Delete this local recovery copy? Its unsaved changes will no longer be recoverable.
                Your saved project and backup will be kept.
              </p>
              <Details candidate={selected} />
            </>
          ) : (
            <>
              <p>
                {sorted.length === 1
                  ? `A local recovery copy is available from ${time(selected.capturedAt)}. Recover it to review your changes before saving.`
                  : `${sorted.length} local recovery copies are available. Select one to review its changes before saving.`}
              </p>
              {sorted.length === 1 ? (
                <Details candidate={selected} />
              ) : (
                <div role="radiogroup" aria-label="Recovery copies">
                  {sorted.map((c, index) => (
                    <label
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: 8,
                        border: `1px solid ${c.id === selected.id ? COLORS.accent : COLORS.border}`,
                        borderRadius: 4,
                        marginBottom: 8
                      }}
                    >
                      <input
                        type="radio"
                        name="recovery-copy"
                        checked={c.id === selected.id}
                        disabled={blocked}
                        onChange={() => {
                          setSelectedId(c.id)
                          setLocalError(null)
                        }}
                        onKeyDown={(event) => {
                          if (
                            !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(
                              event.key
                            ) ||
                            blocked
                          )
                            return
                          event.preventDefault()
                          const next =
                            (index +
                              (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1) +
                              sorted.length) %
                            sorted.length
                          setSelectedId(sorted[next].id)
                          setLocalError(null)
                          overlay.current
                            ?.querySelectorAll<HTMLInputElement>('input[type="radio"]')
                            [next]?.focus()
                        }}
                      />
                      <Details candidate={c} />
                    </label>
                  ))}
                </div>
              )}
              {(problem || failure) && (
                <div role="alert" style={{ color: COLORS.warning, marginTop: 16 }}>
                  <strong>Could not recover project</strong>
                  <p>
                    The recovery copy is incomplete or unreadable. It has been kept. Open the last
                    saved project or try again later.
                  </p>
                  {selected.problem === 'pdf' && (
                    <p>
                      The recovery PDF is missing or damaged. This copy cannot be opened safely.
                    </p>
                  )}
                  {selected.problem === 'metadata' && (
                    <p>The recovery metadata is damaged or unreadable.</p>
                  )}
                  {failure && <p>{failure}</p>}
                </div>
              )}
            </>
          )}
          {blocked && (
            <p role="status">{confirm ? 'Deleting recovery copy…' : 'Recovering project…'}</p>
          )}
        </div>
        <div
          data-recovery-actions
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'flex-end',
            paddingTop: 16,
            flexShrink: 0
          }}
        >
          {confirm ? (
            <>
              <button
                type="button"
                ref={keepCopy}
                disabled={blocked}
                style={buttonStyle}
                onFocus={focus}
                onBlur={(e) => {
                  e.currentTarget.style.outline = ''
                }}
                onClick={() => setConfirm(false)}
              >
                Keep Recovery Copy
              </button>
              <button
                type="button"
                disabled={blocked}
                style={{ ...buttonStyle, color: COLORS.warning }}
                onFocus={focus}
                onBlur={(e) => {
                  e.currentTarget.style.outline = ''
                }}
                onClick={() =>
                  void run(async () => {
                    try {
                      const result = await onDiscard(selected)
                      if (!result.ok) setLocalError(result.message)
                      else setLocalError(null)
                    } catch {
                      setLocalError(
                        'Could not delete the recovery copy. It has been kept. Try again later.'
                      )
                    }
                    setConfirm(false)
                  })
                }
              >
                Delete Recovery Copy
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                ref={keep}
                disabled={blocked}
                style={buttonStyle}
                onFocus={focus}
                onBlur={(e) => {
                  e.currentTarget.style.outline = ''
                }}
                onClick={onKeep}
              >
                Keep for Later
              </button>
              <button
                type="button"
                disabled={blocked}
                style={buttonStyle}
                onFocus={focus}
                onBlur={(e) => {
                  e.currentTarget.style.outline = ''
                }}
                onClick={() => {
                  setLocalError(null)
                  setConfirm(true)
                }}
              >
                Discard Recovery Copy
              </button>
              {(problem || failure) && (
                <button
                  type="button"
                  disabled={blocked}
                  style={buttonStyle}
                  onFocus={focus}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = ''
                  }}
                  onClick={() =>
                    void run(async () => {
                      setLocalError(null)
                      await onRetry()
                    })
                  }
                >
                  Try Again
                </button>
              )}
              <button
                type="button"
                ref={recover}
                disabled={blocked || problem}
                style={{ ...buttonStyle, background: COLORS.accent, color: COLORS.textOnAccent }}
                onFocus={focus}
                onBlur={(e) => {
                  e.currentTarget.style.outline = ''
                }}
                onClick={() => void run(() => onRecover(selected.id))}
              >
                Recover Project
              </button>
            </>
          )}
        </div>
      </section>
    </div>,
    document.body
  )
}
