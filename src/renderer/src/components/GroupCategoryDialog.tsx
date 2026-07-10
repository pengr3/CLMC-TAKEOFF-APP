import { useCallback, useEffect, useRef, useState } from 'react'
import { COLORS } from '../lib/constants'
import { useDraggable } from '../hooks/useDraggable'
import { CategoryAutocomplete } from './CategoryAutocomplete'
import type { Category } from '../types/markup'

export interface GroupCategoryDialogProps {
  /** 'move' reassigns the group's category; 'copy' snapshots it into the chosen category. */
  mode: 'move' | 'copy'
  /** The group being moved/copied — shown in the Move body line. */
  groupName: string
  /**
   * Copy mode only (D-07): the resolved auto-name preview ("{name} (n)") shown in the body
   * line so the resulting snapshot name is never a surprise.
   */
  autoName?: string
  /**
   * Existing categories — used to canonicalize the typed name on confirm (existing-or-new,
   * D-05). Passed in (not read from the store) so the dialog stays presentational + testable.
   */
  categories: Category[]
  /**
   * Confirm — emits the chosen category name (an existing category's canonical name, or a new
   * typed name). Presentational: the hosting panel wires this to moveGroup / copyGroup.
   */
  onConfirm: (categoryName: string) => void
  /** Cancel — ESC, backdrop mousedown, or the Cancel button. */
  onCancel: () => void
}

/**
 * GroupCategoryDialog — the shared Move/Copy category picker (Phase 17 Req 3/4, D-05/D-07).
 *
 * One modal with a `mode` discriminator. It reuses the app modal convention verbatim
 * (DefaultMarkupChangeModal chrome: fixed backdrop zIndex 120, draggable 420px dialog,
 * ESC = Cancel / Enter = Confirm, backdrop-mousedown = Cancel) and composes CategoryAutocomplete
 * beneath an auto-focused Category input for existing-or-new destination selection.
 *
 * Presentational only: it emits `onConfirm(categoryName)` and imports NO command actions
 * (moveGroup/copyGroup). The hosting panel (Wave 4) wires `onConfirm`.
 *
 * Copy mode shows the auto-name preview line `Copy as '{autoName}' into…` (D-07).
 *
 * Enter selects a highlighted autocomplete row (guarded via stopPropagation) instead of
 * confirming; with no row highlighted, Enter confirms; ESC cancels (D-05).
 */
export function GroupCategoryDialog({
  mode,
  groupName,
  autoName,
  categories,
  onConfirm,
  onCancel
}: GroupCategoryDialogProps): React.JSX.Element {
  const [categoryName, setCategoryName] = useState('')
  const [showList, setShowList] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const { position, onPointerDown } = useDraggable()

  // UI-SPEC §5 focus order: the CATEGORY input auto-focuses so the user types immediately
  // (NOT the confirm button — the DefaultMarkupChangeModal confirm auto-focus is superseded).
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const isCopy = mode === 'copy'
  const title = isCopy ? 'Copy to category' : 'Move to category'
  const confirmLabel = isCopy ? 'Copy Group' : 'Move Group'

  const handleConfirm = useCallback((): void => {
    const typed = categoryName.trim()
    // Existing-or-new (D-05): canonicalize against the passed categories so an existing
    // category (case-insensitive) resolves to its stored name; otherwise the typed name
    // flows through as a new category for the panel's moveGroup/copyGroup to resolve.
    const match = categories.find((c) => c.name.toLowerCase() === typed.toLowerCase())
    onConfirm(match ? match.name : typed)
  }, [categoryName, categories, onConfirm])

  // Backdrop-level keys (mirrors DefaultMarkupChangeModal): ESC = Cancel, Enter = Confirm.
  // The input's handleCategoryKeyDown stops propagation for a highlighted-Enter, so that
  // Enter selects the highlighted row instead of reaching this confirm path (D-05 guard).
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    }
  }

  // Arrow-nav + the Enter stopPropagation guard (MarkupNamePopup.handleCategoryKeyDown recipe):
  // when a row is highlighted, Enter selects it and stops propagation so the dialog does NOT
  // confirm; with nothing highlighted, Enter falls through to handleKey → handleConfirm.
  const handleCategoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!showList) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const listbox = document.querySelector('[role="listbox"]')
      const options = listbox ? listbox.querySelectorAll('[role="option"]').length : 0
      if (options === 0) return
      setHighlightedIndex((prev) => (prev + 1) % options)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const listbox = document.querySelector('[role="listbox"]')
      const options = listbox ? listbox.querySelectorAll('[role="option"]').length : 0
      if (options === 0) return
      setHighlightedIndex((prev) => (prev <= 0 ? options - 1 : prev - 1))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      // Guard: stop propagation so the dialog's handleKey does not ALSO confirm (D-05).
      e.preventDefault()
      e.stopPropagation()
      const highlighted = document.querySelector('[data-highlighted="true"]') as HTMLElement | null
      const text = highlighted?.textContent?.trim()
      if (text) {
        const selectedName = text.startsWith('Create new: ')
          ? text.slice('Create new: '.length)
          : text
        setCategoryName(selectedName)
        setShowList(false)
        setHighlightedIndex(-1)
      }
    }
  }

  // Backdrop click = Cancel; ignore clicks that originate inside the dialog body.
  const onBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onCancel()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 28,
    padding: '4px 8px',
    background: COLORS.dominant,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    color: COLORS.textPrimary,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box'
  }

  return (
    <div
      data-testid="group-category-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 120
      }}
      onKeyDown={handleKey}
      onMouseDown={onBackdropMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={onPointerDown}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 420,
          padding: 20,
          background: COLORS.secondary,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          fontSize: 13,
          lineHeight: 1.45,
          color: COLORS.textPrimary,
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

        <div data-testid="group-category-dialog-body">
          {isCopy ? (
            <>
              Copy as <strong style={{ fontWeight: 600 }}>&lsquo;{autoName}&rsquo;</strong> into…
            </>
          ) : (
            <>
              Move <strong style={{ fontWeight: 600 }}>&lsquo;{groupName}&rsquo;</strong> to another
              category.
            </>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Category</label>
          <input
            ref={inputRef}
            type="text"
            value={categoryName}
            onChange={(e) => {
              setCategoryName(e.target.value)
              setShowList(true)
            }}
            onFocus={() => setShowList(true)}
            onBlur={() =>
              setTimeout(() => {
                setShowList(false)
                setHighlightedIndex(-1)
              }, 120)
            }
            onKeyDown={handleCategoryKeyDown}
            placeholder="e.g. Finishes"
            style={inputStyle}
          />
          {showList && (
            <CategoryAutocomplete
              query={categoryName}
              onSelect={(selected) => {
                setCategoryName(selected)
                setShowList(false)
                setHighlightedIndex(-1)
              }}
              highlightedIndex={highlightedIndex}
              onHighlightChange={setHighlightedIndex}
            />
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            aria-label="Cancel"
            onClick={onCancel}
            style={{
              height: 28,
              padding: '4px 8px',
              background: 'transparent',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              color: COLORS.textPrimary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = COLORS.hoverSurface
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            aria-label={confirmLabel}
            onClick={handleConfirm}
            style={{
              height: 28,
              padding: '4px 8px',
              background: COLORS.accent,
              border: 'none',
              borderRadius: 4,
              color: COLORS.textOnAccent,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = COLORS.accentHover
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = COLORS.accent
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.background = COLORS.accentActive
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
