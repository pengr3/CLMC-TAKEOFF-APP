import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { COLORS } from '../lib/constants'
import { CategoryAutocomplete } from './CategoryAutocomplete'

const POPUP_MIN_WIDTH = 240
const POPUP_MAX_WIDTH = 280

export interface MarkupNamePopupProps {
  mode: 'count-pre' | 'save-after'
  // 'count-pre': shown when Count tool activates — primary button reads "Start Count"
  // 'save-after': shown after Linear/Area/Perimeter shape drawn — primary button reads "Save Markup"
  screenPos: { x: number; y: number }
  containerSize: { width: number; height: number }
  initialName?: string
  initialCategoryName?: string
  // Optional measurement preview shown under the inputs (e.g. "12.4 m" for Linear)
  // Rendered if provided; omitted for Count
  measurementPreview?: string
  onConfirm: (payload: { name: string; categoryName: string }) => void
  onCancel: () => void
}

export function MarkupNamePopup({
  mode, screenPos, containerSize,
  initialName = '', initialCategoryName = '',
  measurementPreview, onConfirm, onCancel
}: MarkupNamePopupProps): React.JSX.Element {
  const [name, setName] = useState(initialName)
  const [categoryName, setCategoryName] = useState(initialCategoryName)
  const [showCategoryList, setShowCategoryList] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  const popupStyle = useMemo(() => {
    const left = Math.min(Math.max(screenPos.x, 0), containerSize.width - POPUP_MIN_WIDTH)
    const top = Math.min(Math.max(screenPos.y, 0), containerSize.height - 200)
    return { left, top }
  }, [screenPos, containerSize])

  const handleConfirm = useCallback((): void => {
    const trimmedName = name.trim()
    if (trimmedName === '') {
      setNameError('Enter an item name')
      return
    }
    onConfirm({ name: trimmedName, categoryName: categoryName.trim() })
  }, [name, categoryName, onConfirm])

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
