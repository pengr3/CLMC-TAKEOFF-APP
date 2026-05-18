import { useState, useCallback, useRef, useEffect } from 'react'
import { COLORS } from '../lib/constants'
import { CategoryAutocomplete } from './CategoryAutocomplete'
import { MARKUP_PALETTE, nextPaletteColor } from '../lib/markup-palette'
import { useMarkupStore } from '../stores/markupStore'
import { useDraggable } from '../hooks/useDraggable'

const POPUP_MIN_WIDTH = 260
const POPUP_MAX_WIDTH = 320

export interface MarkupNamePopupProps {
  mode: 'count-pre' | 'save-after' | 'edit'
  // 'count-pre': shown when Count tool activates — primary button reads "Start Count"
  // 'save-after': shown after Linear/Area/Perimeter shape drawn — primary button reads "Save Markup"
  // 'edit': shown when editing an existing markup — primary button reads "Save Changes"
  screenPos: { x: number; y: number }
  containerSize: { width: number; height: number }
  initialName?: string
  initialCategoryName?: string
  /** Optional initial color. If not provided, we inherit from store or pick next unused (D-25). */
  initialColor?: string
  // Optional measurement preview shown under the inputs (e.g. "12.4 m" for Linear)
  // Rendered if provided; omitted for Count
  measurementPreview?: string
  /** Active tool type — when 'wall', shows the wall-height input row (D-09). */
  toolType?: 'count' | 'linear' | 'area' | 'perimeter' | 'wall'
  /** Initial wall height in millimetres. Default 2400 (D-09). */
  initialWallHeight?: number
  /** Payload widened (D-26, D-28, D-09): includes the chosen palette color + optional wallHeight. */
  onConfirm: (payload: { name: string; categoryName: string; color: string; wallHeight?: number }) => void
  onCancel: () => void
}

/**
 * Compute default color following D-25:
 *  - If the name already has a color in the store, inherit it.
 *  - Else pick the next palette swatch not currently in use across ALL pages.
 */
function resolveDefaultColor(
  name: string,
  getColorForName: (n: string) => string | null,
  pageMarkups: Record<number, Array<{ color: string }>>
): string {
  const inherited = name.trim() === '' ? null : getColorForName(name.trim())
  if (inherited) return inherited
  const used = Array.from(
    new Set(
      Object.values(pageMarkups)
        .flat()
        .map((m) => m.color)
    )
  )
  return nextPaletteColor(used)
}

export function MarkupNamePopup({
  mode,
  // screenPos & containerSize: kept in the prop interface so CanvasViewport
  // callsites don't need to change, but no longer used for positioning —
  // D-10/D-14 require the popup to open centred via the overlay below.
  screenPos: _screenPos,
  containerSize: _containerSize,
  initialName = '', initialCategoryName = '',
  initialColor,
  measurementPreview,
  toolType,
  initialWallHeight = 2400,
  onConfirm, onCancel
}: MarkupNamePopupProps): React.JSX.Element {
  const [name, setName] = useState(initialName)
  const [categoryName, setCategoryName] = useState(initialCategoryName)
  const [showCategoryList, setShowCategoryList] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const nameRef = useRef<HTMLInputElement>(null)
  // Wall-height state — only active when toolType === 'wall' (D-09)
  const [wallHeight, setWallHeight] = useState<string>(String(initialWallHeight))
  const [wallHeightError, setWallHeightError] = useState<string | null>(null)
  const { position, onPointerDown } = useDraggable()
  // Touch _screenPos / _containerSize so eslint no-unused-vars stays quiet.
  void _screenPos; void _containerSize

  // Subscribe to store for inheritance lookups (primitive + selector pattern — NOT method-invoking selectors;
  // getColorForName is a stable function reference on the store, so subscribing to it is safe)
  const getColorForName = useMarkupStore((s) => s.getColorForName)
  const pageMarkups = useMarkupStore((s) => s.pageMarkups)
  const findCategoryByName = useMarkupStore((s) => s.findCategoryByName)

  const [selectedColor, setSelectedColor] = useState<string>(
    () => initialColor ?? resolveDefaultColor(initialName, getColorForName, pageMarkups)
  )
  // Track whether user manually overrode the color — once overridden, stop auto-inheriting on name change
  const userOverrodeColor = useRef<boolean>(!!initialColor)

  // D-25 inheritance: when name changes to an existing name, auto-switch color (unless user overrode)
  useEffect(() => {
    if (userOverrodeColor.current) return
    const inherited = name.trim() === '' ? null : getColorForName(name.trim())
    if (inherited) setSelectedColor(inherited)
  }, [name, getColorForName])

  useEffect(() => { nameRef.current?.focus() }, [])

  const handleConfirm = useCallback((): void => {
    const trimmedName = name.trim()
    if (trimmedName === '') {
      setNameError('Enter an item name')
      return
    }
    // D-09 wall-height validation — must be a positive number
    if (toolType === 'wall') {
      const h = parseFloat(wallHeight)
      if (isNaN(h) || h <= 0) {
        setWallHeightError('Enter a positive height in mm')
        return
      }
    }
    // D-13 canonical substitution: replace typed category name with store-canonical version
    const typed = categoryName.trim()
    const canonical = typed === '' ? '' : (findCategoryByName(typed)?.name ?? typed)
    onConfirm({
      name: trimmedName,
      categoryName: canonical,
      color: selectedColor,
      ...(toolType === 'wall' ? { wallHeight: parseFloat(wallHeight) } : {})
    })
  }, [name, categoryName, selectedColor, toolType, wallHeight, onConfirm, findCategoryByName])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  // D-12 keyboard navigation for category autocomplete list
  const handleCategoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!showCategoryList) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      // optionCount is not directly available here — read from rendered DOM to count options
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
      // Landmine 2 mitigation: stop propagation so wrapper div's handleKeyDown doesn't also fire handleConfirm
      e.preventDefault()
      e.stopPropagation()
      // Get the highlighted item's text via data-highlighted attribute
      const highlighted = document.querySelector('[data-highlighted="true"]') as HTMLElement | null
      const text = highlighted?.textContent?.trim()
      if (text) {
        // Strip "Create new: " prefix if this is the create-new row
        const selectedName = text.startsWith('Create new: ') ? text.slice('Create new: '.length) : text
        setCategoryName(selectedName)
        setShowCategoryList(false)
        setHighlightedIndex(-1)
      }
    }
  }

  const primaryCta = mode === 'count-pre' ? 'Start Count' : mode === 'edit' ? 'Save Changes' : 'Save Markup'
  const cancelLabel = mode === 'edit' ? 'Discard Changes' : 'Discard'

  // D-10/D-11/D-14: outer overlay is full-inset, flex-centred, and clicks
  // through to the canvas (pointerEvents: 'none') so it doesn't block normal
  // pointer events outside the popup card. Pitfall 4 — zIndex retained at 10
  // matching the pre-conversion containerStyle.zIndex.
  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 10
  }

  const containerStyle: React.CSSProperties = {
    minWidth: POPUP_MIN_WIDTH,
    maxWidth: POPUP_MAX_WIDTH,
    padding: 16,
    background: COLORS.secondary,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 13,
    lineHeight: 1.4,
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
    <div style={overlayStyle}>
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'count-pre' ? 'Name count item' : mode === 'edit' ? 'Edit markup' : 'Save markup'}
      onKeyDown={handleKeyDown}
      onPointerDown={onPointerDown}
      style={containerStyle}
    >
      <div>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Name</label>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); if (nameError) setNameError(null) }}
          placeholder="e.g. Light Switch"
          style={inputStyle}
        />
        {nameError && (
          <div style={{ color: COLORS.warning, fontSize: 13, marginTop: 4 }}>
            {nameError}
          </div>
        )}
      </div>

      <div>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Category</label>
        <input
          type="text"
          value={categoryName}
          onChange={(e) => { setCategoryName(e.target.value); setShowCategoryList(true) }}
          onFocus={() => setShowCategoryList(true)}
          onBlur={() => setTimeout(() => { setShowCategoryList(false); setHighlightedIndex(-1) }, 120)}
          onKeyDown={handleCategoryKeyDown}
          placeholder="e.g. Electrical"
          style={inputStyle}
        />
        {showCategoryList && (
          <CategoryAutocomplete
            query={categoryName}
            onSelect={(selected) => { setCategoryName(selected); setShowCategoryList(false); setHighlightedIndex(-1) }}
            highlightedIndex={highlightedIndex}
            onHighlightChange={setHighlightedIndex}
          />
        )}
      </div>

      <div>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Color</label>
        <div
          role="radiogroup"
          aria-label="Markup color"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
        >
          {MARKUP_PALETTE.map((hex) => {
            const isSelected = hex === selectedColor
            return (
              <button
                key={hex}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Color ${hex}`}
                onClick={() => {
                  setSelectedColor(hex)
                  userOverrodeColor.current = true
                }}
                style={{
                  width: 24,
                  height: 24,
                  padding: 0,
                  borderRadius: 4,
                  background: hex,
                  border: isSelected ? `2px solid ${COLORS.accent}` : `2px solid ${COLORS.border}`,
                  boxShadow: isSelected ? `inset 0 0 0 2px #ffffff` : 'none',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              />
            )
          })}
        </div>
      </div>

      {toolType === 'wall' && (
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Wall height (mm)</label>
          <input
            type="number"
            min="1"
            value={wallHeight}
            onChange={(e) => { setWallHeight(e.target.value); if (wallHeightError) setWallHeightError(null) }}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="2400"
            style={inputStyle}
          />
          {wallHeightError && (
            <div style={{ color: COLORS.warning, fontSize: 13, marginTop: 4 }}>
              {wallHeightError}
            </div>
          )}
        </div>
      )}

      {mode !== 'edit' && measurementPreview && (
        <div
          style={{
            fontWeight: 600,
            color: COLORS.accent,
            fontFamily: 'monospace'
          }}
        >
          {measurementPreview}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: 28, padding: '4px 8px',
            background: 'transparent',
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4, color: COLORS.textPrimary,
            fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.hoverSurface }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          style={{
            height: 28, padding: '4px 8px',
            background: COLORS.accent,
            border: 'none', borderRadius: 4,
            color: COLORS.textOnAccent,
            fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.accentHover }}
          onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.accent }}
          onMouseDown={(e) => { e.currentTarget.style.background = COLORS.accentActive }}
        >
          {primaryCta}
        </button>
      </div>
    </div>
    </div>
  )
}
