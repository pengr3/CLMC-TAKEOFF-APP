import { useMemo } from 'react'
import { COLORS } from '../lib/constants'
import { useMarkupStore } from '../stores/markupStore'
import type { Category } from '../types/markup'

export interface CategoryAutocompleteProps {
  query: string
  onSelect: (categoryName: string) => void
}

export function CategoryAutocomplete({ query, onSelect }: CategoryAutocompleteProps): React.JSX.Element | null {
  const categories = useMarkupStore((s) => s.getAllCategories())
  const findByName = useMarkupStore((s) => s.findCategoryByName)

  const filtered = useMemo<Category[]>(() => {
    if (query.trim() === '') return categories
    const q = query.trim().toLowerCase()
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [query, categories])

  const hasExactMatch = findByName(query) !== null
  const showCreateOption = query.trim() !== '' && !hasExactMatch

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
    alignItems: 'center',
    gap: 8
  }

  return (
    <div role="listbox" aria-label="Category suggestions" style={listStyle}>
      {filtered.map((cat) => (
        <div
          key={cat.id}
          role="option"
          aria-selected={false}
          onMouseDown={(e) => { e.preventDefault(); onSelect(cat.name) }}
          onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.hoverSurface }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          style={itemStyle}
        >
          <span
            aria-hidden="true"
            style={{
              width: 10, height: 10, borderRadius: '50%',
              background: cat.color, flexShrink: 0
            }}
          />
          <span>{cat.name}</span>
        </div>
      ))}
      {showCreateOption && (
        <div
          role="option"
          aria-selected={false}
          onMouseDown={(e) => { e.preventDefault(); onSelect(query.trim()) }}
          onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.hoverSurface }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          style={{ ...itemStyle, color: COLORS.textSecondary, fontStyle: 'italic' }}
        >
          Create new: {query.trim()}
        </div>
      )}
    </div>
  )
}
