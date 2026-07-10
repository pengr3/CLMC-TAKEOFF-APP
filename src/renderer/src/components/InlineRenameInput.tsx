import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { COLORS } from '../lib/constants'
import { useMarkupStore } from '../stores/markupStore'
import { RenameCollisionMessage } from './RenameCollisionMessage'

export interface InlineRenameInputProps {
  /** The group name currently being edited (seed + rename source key). */
  currentName: string
  /** Called when the editor closes — on a successful/committed rename, an Esc cancel,
   *  or a blank/whitespace commit. The parent unmounts the editor. NOT called while a
   *  collision keeps the editor open. */
  onDone: () => void
}

/**
 * Inline edit-in-place rename editor (D-02 / D-03 / D-04). Uncontrolled input driven
 * by NATIVE blur/Enter/Esc listeners (the EstimateRow rate-cell recipe — React 19's
 * value-tracker + focusout semantics make the React synthetic change/blur props
 * unreliable here, so they are deliberately avoided).
 *
 * Behaviour (UI-SPEC §2/§3):
 *   - Focus + select-all on mount.
 *   - Enter or blur → commit; Esc → cancel (revert). blank/whitespace commit → cancel
 *     silently, no store write (D-03).
 *   - Commit calls useMarkupStore.renameGroup(currentName, trimmed). `{ ok: true }`
 *     closes the editor; `{ ok: false }` (same-type collision) keeps the input open +
 *     focused with the typed text and mounts RenameCollisionMessage (D-04).
 *   - Typing clears any shown collision message; the parent owns nothing here — the
 *     editor manages its own open/blocked state until onDone fires.
 *   - stopPropagation on click/mousedown/keydown so the editor never triggers the
 *     row's cycle/arm handlers.
 *
 * Presentational + decoupled: it is mounted into the real Totals/Estimate rows in
 * Wave 4 (17-06 / 17-07); here it stands alone.
 */
export function InlineRenameInput({
  currentName,
  onDone
}: InlineRenameInputProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  // The typed name that collided — non-null while the block message is shown.
  const [collision, setCollision] = useState<string | null>(null)

  // Focus + select-all on mount (UI-SPEC §2).
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [])

  // Native-listener effect (React-19-safe): blur/Enter commit, Esc cancel, input →
  // clear collision, stopPropagation on click/mousedown/keydown — via the raw DOM
  // events, never the React synthetic change/blur props. Re-bound if the edited
  // group identity changes.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return

    const commit = (): void => {
      const trimmed = el.value.trim()
      // D-03: blank/whitespace commit cancels silently — zero store writes.
      if (trimmed.length === 0) {
        onDone()
        return
      }
      const { ok } = useMarkupStore.getState().renameGroup(currentName, trimmed)
      if (ok) {
        onDone()
        return
      }
      // D-04: same-type collision → keep the editor open + focused with the typed
      // text and surface the blocking message. blur may have fired to drive this
      // commit, so re-assert focus.
      setCollision(trimmed)
      el.focus()
    }

    const onBlur = (): void => commit()
    const onKeyDown = (e: KeyboardEvent): void => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        commit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        // Esc cancels the whole rename — revert the field, no store write.
        el.value = currentName
        onDone()
      }
    }
    // Typing dismisses a shown collision message (D-04 — parent-free, no timer).
    const onInput = (): void => {
      setCollision((c) => (c === null ? c : null))
    }
    const onStop = (e: Event): void => e.stopPropagation()

    el.addEventListener('blur', onBlur)
    el.addEventListener('keydown', onKeyDown)
    el.addEventListener('input', onInput)
    el.addEventListener('click', onStop)
    el.addEventListener('mousedown', onStop)
    return () => {
      el.removeEventListener('blur', onBlur)
      el.removeEventListener('keydown', onKeyDown)
      el.removeEventListener('input', onInput)
      el.removeEventListener('click', onStop)
      el.removeEventListener('mousedown', onStop)
    }
    // commit closes over currentName/onDone; re-bind when the edited group changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentName])

  return (
    <span style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        defaultValue={currentName}
        aria-label={`Rename ${currentName}`}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          height: 22,
          padding: '0 6px',
          background: COLORS.dominant,
          // 1px accent border while editing doubles as the focus ring (UI-SPEC §2).
          border: `1px solid ${COLORS.accent}`,
          borderRadius: 4,
          color: COLORS.textPrimary,
          fontSize: 13,
          fontWeight: 400,
          textAlign: 'left',
          outline: 'none'
        }}
      />
      {collision !== null && <RenameCollisionMessage name={collision} />}
    </span>
  )
}
