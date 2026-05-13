import { useMemo, useEffect } from 'react'
import { COLORS } from '../lib/constants'
import { useMarkupStore } from '../stores/markupStore'
import type { Category } from '../types/markup'

export interface CategoryAutocompleteProps {
  query: string
  onSelect: (categoryName: string) => void
  /** -1 = nothing highlighted; controlled from MarkupNamePopup */
  highlightedIndex?: number
  onHighlightChange?: (i: number) => void
}

export function CategoryAutocomplete({
  query,
  onSelect,
  highlightedIndex,
  onHighlightChange
}: CategoryAutocompleteProps): React.JSX.Element | null {
  // Select primitive store fields — getAllCategories() returns a fresh array
  // each call, which breaks useSyncExternalStore's snapshot equality check
  // and infinite-loops the renderer.
  const categoriesById = useMarkupStore((s) => s.categories)
  const categoryOrder = useMarkupStore((s) => s.categoryOrder)
  const findByName = useMarkupStore((s) => s.findCategoryByName)

  const categories = useMemo<Category[]>(
    () =>
      categoryOrder
        .map((id) => categoriesById[id])
        .filter((c): c is Category => Boolean(c)),
    [categoryOrder, categoriesById]
  )

  const filtered = useMemo<Category[]>(() => {
    if (query.trim() === '') return categories
    const q = query.trim().toLowerCase()
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [query, categories])

  const hasExactMatch = findByName(query) !== null
  const showCreateOption = query.trim() !== '' && !hasExactMatch

  // Compute total option count (filtered rows + optional create-new row)
  const optionCount = filtered.length + (showCreateOption ? 1 : 0)

  // Clamp highlightedIndex to valid range
  const clampedIndex =
    highlightedIndex === undefined || highlightedIndex < 0
      ? -1
      : highlightedIndex >= optionCount
        ? optionCount - 1
        : highlightedIndex

  // Auto-scroll highlighted row into view
  useEffect(() => {
    if (clampedIndex < 0) return
    const highlighted = document.querySelector('[data-highlighted="true"]') as HTMLElement | null
    highlighted?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }, [clampedIndex])

  // Reset highlight when query changes
  useEffect(() => {
    onHighlightChange?.(-1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  if (filtered.length === 0 && !showCreateOption) return null

  const listStyle: React.CSSProperties = {
    maxHeight: 120,
    overflowY: 'auto',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    background: COLORS.secondary,
    marginTop: 4
  }

  const itemStyle: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: 13,
    color: COLORS.textPrimary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
    // gap removed — only one child now (D-27: Category no longer carries color)
  }

  return (
    <div role="listbox" aria-label="Category suggestions" style={listStyle}>
      {filtered.map((cat, idx) => {
        const isHighlighted = clampedIndex === idx
        return (
          <div
            key={cat.id}
            role="option"
            aria-selected={false}
            data-highlighted={isHighlighted ? 'true' : undefined}
            onMouseDown={(e) => { e.preventDefault(); onSelect(cat.name) }}
            onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.hoverSurface }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isHighlighted ? COLORS.hoverSurface : 'transparent'
            }}
            style={{
              ...itemStyle,
              background: isHighlighted ? COLORS.hoverSurface : 'transparent',
              borderLeft: isHighlighted ? `2px solid ${COLORS.accent}` : 'none'
            }}
          >
            <span>{cat.name}</span>
          </div>
        )
      })}
      {showCreateOption && (() => {
        const createIdx = filtered.length
        const isHighlighted = clampedIndex === createIdx
        return (
          <div
            role="option"
            aria-selected={false}
            data-highlighted={isHighlighted ? 'true' : undefined}
            onMouseDown={(e) => { e.preventDefault(); onSelect(query.trim()) }}
            onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.hoverSurface }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isHighlighted ? COLORS.hoverSurface : 'transparent'
            }}
            style={{
              ...itemStyle,
              color: COLORS.textSecondary,
              fontStyle: 'italic',
              background: isHighlighted ? COLORS.hoverSurface : 'transparent',
              borderLeft: isHighlighted ? `2px solid ${COLORS.accent}` : 'none'
            }}
          >
            Create new: {query.trim()}
          </div>
        )
      })()}
    </div>
  )
}
