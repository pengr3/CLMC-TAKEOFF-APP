import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { COLORS } from '../lib/constants'
import { CategoryAutocomplete } from './CategoryAutocomplete'
import { MARKUP_PALETTE, nextPaletteColor } from '../lib/markup-palette'
import { useMarkupStore } from '../stores/markupStore'

const POPUP_MIN_WIDTH = 260
const POPUP_MAX_WIDTH = 320

export interface MarkupNamePopupProps {
  mode: 'count-pre' | 'save-after'
  // 'count-pre': shown when Count tool activates — primary button reads "Start Count"
  // 'save-after': shown after Linear/Area/Perimeter shape drawn — primary button reads "Save Markup"
  screenPos: { x: number; y: number }
  containerSize: { width: number; height: number }
  initialName?: string
  initialCategoryName?: string
  /** Optional initial color. If not provided, we inherit from store or pick next unused (D-25). */
  initialColor?: string
  // Optional measurement preview shown under the inputs (e.g. "12.4 m" for Linear)
  // Rendered if provided; omitted for Count
  measurementPreview?: string
  /** Payload widened (D-26, D-28): includes the chosen palette color. */
  onConfirm: (payload: { name: string; categoryName: string; color: string }) => void
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
  mode, screenPos, containerSize,
  initialName = '', initialCategoryName = '',
  initialColor,
  measurementPreview, onConfirm, onCancel
}: MarkupNamePopupProps): React.JSX.Element {
  const [name, setName] = useState(initialName)
  const [categoryName, setCategoryName] = useState(initialCategoryName)
  const [showCategoryList, setShowCategoryList] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // Subscribe to store for inheritance lookups (primitive + selector pattern — NOT method-invoking selectors;
  // getColorForName is a stable function reference on the store, so subscribing to it is safe)
  const getColorForName = useMarkupStore((s) => s.getColorForName)
  const pageMarkups = useMarkupStore((s) => s.pageMarkups)

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

  const popupStyle = useMemo(() => {
    const left = Math.min(Math.max(screenPos.x, 0), containerSize.width - POPUP_MIN_WIDTH)
    const top = Math.min(Math.max(screenPos.y, 0), containerSize.height - 240)
    return { left, top }
  }, [screenPos, containerSize])

  const handleConfirm = useCallback((): void => {
    const trimmedName = name.trim()
    if (trimmedName === '') {
      setNameError('Enter an item name')
      return
    }
    onConfirm({
      name: trimmedName,
      categoryName: categoryName.trim(),
      color: selectedColor
    })
  }, [name, categoryName, selectedColor, onConfirm])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  const primaryCta = mode === 'count-pre' ? 'Start Count' : 'Save Markup'
  const cancelLabel = 'Discard'

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: popupStyle.left,
    top: popupStyle.top,
    minWidth: POPUP_MIN_WIDTH,
    maxWidth: POPUP_MAX_WIDTH,
    padding: 16,
    background: COLORS.secondary,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 13,
    lineHeight: 1.4,
    color: COLORS.textPrimary
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
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'count-pre' ? 'Name count item' : 'Save markup'}
      onKeyDown={handleKeyDown}
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
          onBlur={() => setTimeout(() => setShowCategoryList(false), 120)}
          placeholder="e.g. Electrical"
          style={inputStyle}
        />
        {showCategoryList && (
          <CategoryAutocomplete
            query={categoryName}
            onSelect={(selected) => { setCategoryName(selected); setShowCategoryList(false) }}
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

      {measurementPreview && (
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
  )
}
