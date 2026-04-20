import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import type { CountMarkup, LinearMarkup } from '@renderer/types/markup'
import { CATEGORY_PALETTE } from '@renderer/types/markup'

function makeCount(
  page: number,
  name: string,
  sequence: number,
  categoryId = 'cat-1'
): CountMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'count',
    page,
    name,
    categoryId,
    sequence,
    point: { x: 10, y: 10 },
    createdAt: Date.now()
  }
}

function makeLinear(page: number, name: string, categoryId = 'cat-1'): LinearMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'linear',
    page,
    name,
    categoryId,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 10 }
    ],
    createdAt: Date.now()
  }
}

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
})

describe('categories', () => {
  it('getOrCreateCategory returns category with first palette color', () => {
    const cat = useMarkupStore.getState().getOrCreateCategory('Electrical')
    expect(cat.color).toBe('#0078d4')
    expect(cat.paletteIndex).toBe(0)
  })

  it('case-insensitive deduplication: lowercase returns same category id', () => {
    const cat1 = useMarkupStore.getState().getOrCreateCategory('Electrical')
    const cat2 = useMarkupStore.getState().getOrCreateCategory('electrical')
    expect(cat2.id).toBe(cat1.id)
    expect(cat2.color).toBe(cat1.color)
  })

  it('creating 8 categories assigns paletteIndex 0..7', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const cats = names.map((n) => useMarkupStore.getState().getOrCreateCategory(n))
    cats.forEach((cat, i) => {
      expect(cat.paletteIndex).toBe(i)
      expect(cat.color).toBe(CATEGORY_PALETTE[i])
    })
  })

  it('9th category creation wraps paletteIndex to 0 (palette cycles)', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    names.forEach((n) => useMarkupStore.getState().getOrCreateCategory(n))
    const ninth = useMarkupStore.getState().getOrCreateCategory('I')
    expect(ninth.paletteIndex).toBe(0)
    expect(ninth.color).toBe('#0078d4')
  })

  it('trims whitespace from name', () => {
    const cat = useMarkupStore.getState().getOrCreateCategory('  Plumbing  ')
    expect(cat.name).toBe('Plumbing')
  })

  it('findCategoryByName returns the correct category', () => {
    const cat = useMarkupStore.getState().getOrCreateCategory('Electrical')
    const found = useMarkupStore.getState().findCategoryByName('Electrical')
    expect(found?.id).toBe(cat.id)
  })

  it('findCategoryByName returns null for unknown name', () => {
    expect(useMarkupStore.getState().findCategoryByName('Unknown')).toBeNull()
  })

  it('getAllCategories returns categories in creation order', () => {
    const c1 = useMarkupStore.getState().getOrCreateCategory('Alpha')
    const c2 = useMarkupStore.getState().getOrCreateCategory('Beta')
    const c3 = useMarkupStore.getState().getOrCreateCategory('Gamma')
    const all = useMarkupStore.getState().getAllCategories()
    expect(all.map((c) => c.id)).toEqual([c1.id, c2.id, c3.id])
  })
})

describe('per-page markups', () => {
  it('getMarkups returns [] initially', () => {
    expect(useMarkupStore.getState().getMarkups(1)).toEqual([])
  })

  it('placeMarkup stores markup on the correct page', () => {
    const m = makeCount(1, 'Light', 1)
    useMarkupStore.getState().placeMarkup(m)
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(1)
    expect(useMarkupStore.getState().getMarkups(2)).toHaveLength(0)
  })

  it('deleteMarkup removes markup from page', () => {
    const m = makeCount(1, 'Light', 1)
    useMarkupStore.getState().placeMarkup(m)
    useMarkupStore.getState().deleteMarkup(1, m.id)
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(0)
  })

  it('placeMarkup accepts all four markup types', () => {
    const count = makeCount(1, 'Switch', 1)
    const linear = makeLinear(1, 'Pipe')
    const area = {
      id: crypto.randomUUID(),
      type: 'area' as const,
      page: 1,
      name: 'Floor',
      categoryId: 'cat-1',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ],
      createdAt: Date.now()
    }
    const perimeter = {
      id: crypto.randomUUID(),
      type: 'perimeter' as const,
      page: 1,
      name: 'Wall',
      categoryId: 'cat-1',
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 }
      ],
      createdAt: Date.now()
    }
    useMarkupStore.getState().placeMarkup(count)
    useMarkupStore.getState().placeMarkup(linear)
    useMarkupStore.getState().placeMarkup(area)
    useMarkupStore.getState().placeMarkup(perimeter)
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(4)
  })
})

describe('nextCountSequence', () => {
  it('returns 1 when no count markups exist for that name on page 1', () => {
    expect(useMarkupStore.getState().nextCountSequence(1, 'Light Switch')).toBe(1)
  })

  it('returns max(sequence) + 1 after placing 3 markups', () => {
    const { placeMarkup, nextCountSequence } = useMarkupStore.getState()
    placeMarkup(makeCount(1, 'Light Switch', 1))
    placeMarkup(makeCount(1, 'Light Switch', 2))
    placeMarkup(makeCount(1, 'Light Switch', 3))
    expect(nextCountSequence(1, 'Light Switch')).toBe(4)
  })

  it('gap preserved after delete (Pitfall 5): place 1,2,3; delete 2; next is 4 not 2', () => {
    const m1 = makeCount(1, 'Light Switch', 1)
    const m2 = makeCount(1, 'Light Switch', 2)
    const m3 = makeCount(1, 'Light Switch', 3)
    useMarkupStore.getState().placeMarkup(m1)
    useMarkupStore.getState().placeMarkup(m2)
    useMarkupStore.getState().placeMarkup(m3)
    useMarkupStore.getState().deleteMarkup(1, m2.id)
    expect(useMarkupStore.getState().nextCountSequence(1, 'Light Switch')).toBe(4)
  })

  it('different names tracked independently', () => {
    useMarkupStore.getState().placeMarkup(makeCount(1, 'Light Switch', 1))
    useMarkupStore.getState().placeMarkup(makeCount(1, 'Light Switch', 2))
    useMarkupStore.getState().placeMarkup(makeCount(1, 'Light Switch', 3))
    expect(useMarkupStore.getState().nextCountSequence(1, 'Outlet')).toBe(1)
  })

  it('different pages tracked independently', () => {
    useMarkupStore.getState().placeMarkup(makeCount(1, 'Light Switch', 1))
    useMarkupStore.getState().placeMarkup(makeCount(1, 'Light Switch', 2))
    expect(useMarkupStore.getState().nextCountSequence(2, 'Light Switch')).toBe(1)
  })
})

describe('command generation', () => {
  it('placeMarkup pushes a place command to undoStack', () => {
    const m = makeCount(1, 'Test', 1)
    useMarkupStore.getState().placeMarkup(m)
    const { undoStack } = useMarkupStore.getState()
    expect(undoStack).toHaveLength(1)
    expect(undoStack[0].type).toBe('place')
    expect(undoStack[0].markup.id).toBe(m.id)
  })

  it('placeMarkup clears redoStack', () => {
    const m1 = makeCount(1, 'A', 1)
    const m2 = makeCount(1, 'B', 2)
    useMarkupStore.getState().placeMarkup(m1)
    useMarkupStore.getState().undo()
    expect(useMarkupStore.getState().redoStack).toHaveLength(1)
    useMarkupStore.getState().placeMarkup(m2)
    expect(useMarkupStore.getState().redoStack).toHaveLength(0)
  })

  it('deleteMarkup pushes a delete command to undoStack with full markup', () => {
    const m = makeCount(1, 'Test', 1)
    useMarkupStore.getState().placeMarkup(m)
    useMarkupStore.getState().deleteMarkup(1, m.id)
    const { undoStack } = useMarkupStore.getState()
    expect(undoStack).toHaveLength(2)
    expect(undoStack[1].type).toBe('delete')
    expect(undoStack[1].markup).toEqual(m)
  })

  it('deleteMarkup clears redoStack', () => {
    const m1 = makeCount(1, 'A', 1)
    const m2 = makeCount(1, 'B', 2)
    useMarkupStore.getState().placeMarkup(m1)
    useMarkupStore.getState().placeMarkup(m2)
    useMarkupStore.getState().undo()
    expect(useMarkupStore.getState().redoStack).toHaveLength(1)
    useMarkupStore.getState().deleteMarkup(1, m1.id)
    expect(useMarkupStore.getState().redoStack).toHaveLength(0)
  })

  it('deleteMarkup on non-existent id is a no-op (does not throw, does not push command)', () => {
    const m = makeCount(1, 'Test', 1)
    useMarkupStore.getState().placeMarkup(m)
    expect(() =>
      useMarkupStore.getState().deleteMarkup(1, 'nonexistent-id')
    ).not.toThrow()
    expect(useMarkupStore.getState().undoStack).toHaveLength(1)
  })
})
