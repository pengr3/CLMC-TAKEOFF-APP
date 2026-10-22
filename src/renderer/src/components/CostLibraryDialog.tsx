import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen } from 'lucide-react'
import { COLORS } from '../lib/constants'
import { CURRENCY_SYMBOL } from '../lib/currency'
import { applyLibraryRate } from '../lib/apply-library-rate'
import { labelToName } from './TotalsRow'
import type { BoqItemRow } from '../lib/boq-types'
import {
  normalizeLibraryUnit,
  LIBRARY_IMPORT_MESSAGES,
  type CostLibrarySnapshot,
  type LibraryPreview,
  type LibraryIssue
} from '../../../shared/cost-library'

const buttonStyle: React.CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 4,
  padding: '6px 10px',
  background: COLORS.secondary,
  color: COLORS.textPrimary,
  cursor: 'pointer',
  fontSize: 12
}
const money = (value: number): string => `${CURRENCY_SYMBOL}${value.toFixed(2)}`

interface DialogProps {
  target?: BoqItemRow
  onClose: () => void
}

export function CostLibraryDialog({ target, onClose }: DialogProps): React.JSX.Element {
  const titleId = useId()
  const [library, setLibrary] = useState<CostLibrarySnapshot | null>(null)
  const [preview, setPreview] = useState<LibraryPreview | null>(null)
  const [operation, setOperation] = useState<
    'loading' | 'checking' | 'replacing' | 'template' | null
  >('loading')
  const busy = operation !== null
  const [message, setMessage] = useState('')
  const [issues, setIssues] = useState<LibraryIssue[]>([])
  const [query, setQuery] = useState('')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const tokenRef = useRef<string | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    const previousFocus = document.activeElement as HTMLElement | null
    const containFocus = (): void => {
      const dialog = dialogRef.current
      if (dialog && !dialog.contains(document.activeElement)) dialog.focus()
    }
    document.addEventListener('focusin', containFocus)
    window.addEventListener('focus', containFocus)
    dialogRef.current?.focus()
    window.api.costLibrary
      .load()
      .then((result) => {
        if (!alive.current) return
        if (result.ok) setLibrary(result.value)
        else setMessage(result.reason)
      })
      .catch(() => {
        if (alive.current) setMessage('Could not load the cost library. Try reopening it.')
      })
      .finally(() => {
        if (alive.current) setOperation(null)
      })
    return () => {
      alive.current = false
      document.removeEventListener('focusin', containFocus)
      window.removeEventListener('focus', containFocus)
      if (tokenRef.current) void window.api.costLibrary.cancel(tokenRef.current).catch(() => {})
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  useEffect(() => {
    // Native pickers and disabling their invoking button can return focus to body.
    // Reclaim focus after the operation without disturbing an active dialog input.
    const dialog = dialogRef.current
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus()
  }, [busy])

  const importFile = async (): Promise<void> => {
    setOperation('checking')
    setPreview(null)
    tokenRef.current = null
    setQuery('')
    setMessage('')
    setIssues([])
    setSelectedCode(null)
    try {
      console.info('[cost-library] Library import requested')
      const result = await window.api.costLibrary.preview()
      console.info('[cost-library] Library import result', {
        ok: result.ok,
        cancelled: result.ok && result.value === null
      })
      if (!alive.current) {
        if (result.ok && result.value)
          void window.api.costLibrary.cancel(result.value.token).catch(() => {})
        return
      }
      if (result.ok) {
        setPreview(result.value)
        tokenRef.current = result.value?.token ?? null
        if (!result.value)
          setMessage('Library import cancelled. Your current library is unchanged.')
      } else {
        setMessage(result.code ? LIBRARY_IMPORT_MESSAGES[result.code] : result.reason)
        setIssues(result.issues ?? [])
      }
    } catch (error) {
      console.error('[cost-library] Library import request failed', error)
      if (alive.current) setMessage('Could not import the file. Your current library was kept.')
    } finally {
      if (alive.current) setOperation(null)
    }
  }
  const cancelPreview = (): void => {
    if (tokenRef.current) void window.api.costLibrary.cancel(tokenRef.current).catch(() => {})
    tokenRef.current = null
    setPreview(null)
    setMessage('')
    setIssues([])
  }
  const replace = async (): Promise<void> => {
    if (!preview) return
    setOperation('replacing')
    setMessage('')
    try {
      const result = await window.api.costLibrary.commit(preview.token)
      if (!alive.current) return
      if (result.ok) {
        setLibrary(result.value)
        setPreview(null)
        tokenRef.current = null
        setSelectedCode(null)
        setMessage('Library replaced on this PC. Existing project rates are unchanged.')
      } else setMessage(result.reason)
    } catch {
      if (alive.current)
        setMessage('Could not save the new library. Your current library was kept.')
    } finally {
      if (alive.current) setOperation(null)
    }
  }
  const download = async (): Promise<void> => {
    setOperation('template')
    setMessage('')
    try {
      console.info('[cost-library] Template download requested')
      const result = await window.api.costLibrary.downloadTemplate()
      console.info('[cost-library] Template download result', result)
      if (alive.current)
        setMessage(
          result.ok
            ? result.value
              ? 'Template saved. Fill it in Excel, then import it on each PC.'
              : 'Template download cancelled. No file was saved.'
            : result.reason
        )
    } catch (error) {
      console.error('[cost-library] Template download request failed', error)
      if (alive.current) setMessage('Could not save the template. Try another folder.')
    } finally {
      if (alive.current) setOperation(null)
    }
  }
  const selected = library?.items.find((item) => item.code === selectedCode)
  const compatible =
    !!target &&
    !!selected &&
    normalizeLibraryUnit(target.uom) === normalizeLibraryUnit(selected.unit)
  const filtered =
    (preview?.library ?? library)?.items.filter((item) =>
      `${item.code} ${item.description} ${item.category}`
        .toLowerCase()
        .includes(query.toLowerCase().trim())
    ) ?? []
  const shown = filtered.slice(0, preview ? 20 : 100)

  return createPortal(
    <div
      data-testid="cost-library-backdrop"
      onMouseDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget && !busy) onClose()
      }}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onKeyUp={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          if (!busy) onClose()
        }
        if (event.key === 'Tab') {
          const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), [tabindex="0"]'
            ) ?? []
          )
          const first = focusable[0]
          const last = focusable.at(-1)
          if (
            event.shiftKey &&
            (document.activeElement === first || document.activeElement === dialogRef.current)
          ) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          } else if (!focusable.length) event.preventDefault()
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 130,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-busy={busy}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          width: 900,
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 48px)',
          overflow: 'hidden',
          overflowWrap: 'anywhere',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          padding: 20,
          borderRadius: 8,
          background: COLORS.dominant,
          color: COLORS.textPrimary,
          border: `1px solid ${COLORS.border}`,
          fontSize: 13,
          boxShadow: '0 12px 40px #0008'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexShrink: 0
          }}
        >
          <h2 id={titleId} style={{ fontSize: 17, margin: 0 }}>
            {target ? `Choose rates for ${labelToName(target.label)}` : 'Cost Library'}
          </h2>
          <button type="button" style={buttonStyle} disabled={busy} onClick={onClose}>
            Close
          </button>
        </div>
        <div
          data-testid="cost-library-content"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            minHeight: 0,
            overflowY: 'auto'
          }}
        >
          <div style={{ color: COLORS.textSecondary, lineHeight: 1.6 }}>
            Maintain your master spreadsheet in Excel and import updates on each PC. Rates are
            available offline.
            {target && (
              <div>
                Choose a rate per{' '}
                <strong style={{ color: COLORS.textPrimary }}>{target.uom}</strong>. Applying
                replaces material and labor for all “{labelToName(target.label)}” {target.type}{' '}
                items across categories. Selling markup and item names stay unchanged.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              style={buttonStyle}
              disabled={busy || !!preview}
              onClick={() => void download()}
            >
              Download Excel Template
            </button>
            <button
              type="button"
              style={buttonStyle}
              disabled={busy || !!preview}
              onClick={() => void importFile()}
            >
              Import CSV / Excel
            </button>
            {busy && (
              <span role="status" aria-live="polite">
                {operation === 'checking'
                  ? 'Checking workbook… Your current library is unchanged.'
                  : operation === 'replacing'
                    ? 'Replacing library…'
                    : operation === 'template'
                      ? 'Saving template…'
                      : 'Loading cost library…'}
              </span>
            )}
          </div>
          {library && (
            <div data-testid="cost-library-metadata" style={{ color: COLORS.textSecondary }}>
              Current library: {library.sourceFilename} · {library.items.length.toLocaleString()}{' '}
              items · Imported {new Date(library.importedAt).toLocaleString()}
            </div>
          )}
          {message && (
            <div role="status" aria-live="polite" style={{ color: COLORS.textPrimary }}>
              {message}
            </div>
          )}
          {issues.length > 0 && (
            <ul
              aria-label="Import errors"
              style={{ maxHeight: 160, overflow: 'auto', margin: 0, paddingLeft: 22 }}
            >
              {issues.map((issue, index) => (
                <li key={index}>
                  Row {issue.row}, {issue.column}: {issue.message}
                </li>
              ))}
              {issues.length >= 100 && (
                <li>Showing the first 100 errors. Fix these and import again.</li>
              )}
            </ul>
          )}
          {(library || preview) && (
            <>
              <input
                aria-label="Search cost library"
                placeholder="Search item code, description or category"
                value={query}
                disabled={busy}
                onChange={(event) => setQuery(event.target.value)}
                style={{
                  padding: 8,
                  background: COLORS.secondary,
                  color: COLORS.textPrimary,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 4
                }}
              />
              <div
                data-testid="cost-library-table-scroll"
                tabIndex={0}
                aria-label="Cost library items"
                style={{ overflow: 'auto', minHeight: 80, maxHeight: 340, flexShrink: 0 }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: 12
                  }}
                >
                  <thead style={{ position: 'sticky', top: 0, background: COLORS.secondary }}>
                    <tr>
                      {[
                        'Item',
                        'Category',
                        'Unit',
                        'Material / unit',
                        'Labor / unit',
                        ...(target && !preview ? ['Select'] : [])
                      ].map((heading) => (
                        <th key={heading} scope="col" style={{ padding: 8 }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((item) => {
                      const matches =
                        !target ||
                        normalizeLibraryUnit(target.uom) === normalizeLibraryUnit(item.unit)
                      return (
                        <tr
                          key={item.code}
                          style={{
                            background:
                              selectedCode === item.code ? COLORS.activeSurface : undefined,
                            borderBottom: `1px solid ${COLORS.border}`
                          }}
                        >
                          <td style={{ padding: 8 }}>
                            <strong>{item.code}</strong>
                            <div>{item.description}</div>
                          </td>
                          <td style={{ padding: 8 }}>{item.category}</td>
                          <td style={{ padding: 8 }}>{item.unit}</td>
                          <td
                            style={{
                              padding: 8,
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums'
                            }}
                          >
                            {money(item.material)}
                          </td>
                          <td
                            style={{
                              padding: 8,
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums'
                            }}
                          >
                            {money(item.labor)}
                          </td>
                          {target && !preview && (
                            <td style={{ padding: 8 }}>
                              <button
                                type="button"
                                style={buttonStyle}
                                disabled={busy || !matches}
                                aria-pressed={selectedCode === item.code}
                                aria-label={`Select ${item.code}`}
                                title={
                                  matches
                                    ? 'Select rates'
                                    : `Requires ${target.uom}; no automatic rate conversion`
                                }
                                onClick={() => setSelectedCode(item.code)}
                              >
                                {matches
                                  ? selectedCode === item.code
                                    ? 'Selected'
                                    : 'Select'
                                  : `Needs ${target.uom}`}
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {!shown.length && <p>No matching items. Try another search.</p>}
              </div>
              <div style={{ color: COLORS.textSecondary }}>
                Showing {shown.length} of {filtered.length.toLocaleString()} matching items
                {filtered.length > shown.length ? ' — narrow your search to see more.' : '.'}
              </div>
            </>
          )}
          {!library && !preview && !busy && (
            <p>
              No cost library on this PC. Download the template, fill your rates, then import it.
            </p>
          )}
        </div>
        {preview && (
          <div
            data-testid="cost-library-preview-footer"
            style={{
              flexShrink: 0,
              padding: 12,
              border: `1px solid ${COLORS.warning}`,
              borderRadius: 4
            }}
          >
            <strong>
              Preview: {preview.library.sourceFilename} ·{' '}
              {preview.library.items.length.toLocaleString()} items
            </strong>
            <p style={{ margin: '6px 0 10px' }}>
              Replace the complete library on this PC? Existing estimates keep their saved rates.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={buttonStyle} disabled={busy} onClick={cancelPreview}>
                Cancel Import
              </button>
              <button
                type="button"
                style={{
                  ...buttonStyle,
                  background: COLORS.accent,
                  color: COLORS.textOnAccent
                }}
                disabled={busy}
                onClick={() => void replace()}
              >
                Replace Library
              </button>
            </div>
          </div>
        )}
        {target && !preview && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
              flexShrink: 0
            }}
          >
            <span>
              {selected
                ? `${selected.code}: ${money(selected.material)} material + ${money(selected.labor)} labor per ${selected.unit}`
                : 'Select a compatible item to apply its rates.'}
            </span>
            <button
              type="button"
              style={{ ...buttonStyle, background: COLORS.accent, color: COLORS.textOnAccent }}
              disabled={busy || !compatible}
              onClick={() => {
                if (!selected) return
                const result = applyLibraryRate(target, selected)
                if (result.ok) onClose()
                else setMessage(result.reason)
              }}
            >
              Apply Rates
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export function CostLibraryButton({ target }: { target?: BoqItemRow }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const name = target ? `Choose library rates for ${labelToName(target.label)}` : 'Cost Library'
  return (
    <>
      <button
        type="button"
        aria-label={name}
        title={name}
        style={
          target
            ? {
                ...buttonStyle,
                padding: '2px 4px',
                display: 'inline-flex',
                flexShrink: 0,
                minWidth: 28,
                minHeight: 28,
                alignItems: 'center',
                justifyContent: 'center'
              }
            : buttonStyle
        }
        onMouseDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
      >
        {target ? <BookOpen size={13} aria-hidden="true" /> : 'Cost Library'}
      </button>
      {open && <CostLibraryDialog target={target} onClose={() => setOpen(false)} />}
    </>
  )
}
