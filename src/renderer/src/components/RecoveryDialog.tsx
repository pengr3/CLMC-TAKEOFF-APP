import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { RecoveryCandidate } from '../../../../shared/reliability'
import { COLORS } from '../lib/constants'

export function RecoveryDialog({ candidates, busy, error, onKeep, onRecover }: {
  candidates: RecoveryCandidate[]; busy: boolean; error: string | null
  onKeep: () => void; onRecover: (id: string) => void
}): React.JSX.Element {
  const recover = useRef<HTMLButtonElement>(null)
  useEffect(() => { const prior = document.activeElement as HTMLElement | null; recover.current?.focus(); return () => prior?.focus() }, [])
  return createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 140, display: 'grid', placeItems: 'center', background: '#0008', padding: 24 }}
    onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape' && !busy) onKeep() }} onKeyUp={e => e.stopPropagation()}>
    <section role="dialog" aria-modal="true" aria-label="Recover unsaved work?" style={{ width: 640, maxWidth: '100%', padding: 20, borderRadius: 8, color: COLORS.textPrimary, background: COLORS.secondary, overflowWrap: 'anywhere' }}>
      <h2>Recover unsaved work?</h2>
      <p>A local recovery copy is available from {new Date(candidates[0].capturedAt).toLocaleString()}. Recover it to review your changes before saving.</p>
      <p>{candidates[0].filename} · {candidates[0].sourcePath ?? 'Not yet saved as a project'}</p>
      {busy && <p role="status">Recovering project…</p>}
      {error && <p role="alert">Could not recover project. {error}</p>}
      <button type="button" disabled={busy} onClick={onKeep}>Keep for Later</button>{' '}
      <button type="button" ref={recover} disabled={busy || !candidates[0].restorable} onClick={() => onRecover(candidates[0].id)}>Recover Project</button>
    </section>
  </div>, document.body)
}
