import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { CountMarkup, AreaMarkup, Markup } from '@renderer/types/markup'
import type { PriceEntry } from '@renderer/lib/boq-types'

// Phase 17-02 Req 1 (D-03/D-04): renameGroup flips .name on every markup in the group
// (all pages) and atomically re-keys the three name-keyed structures — rates
// (`name|type`), hiddenItemNames (composite `name|categoryId`), and categoryItemOrder
// (`name|type`) — reverted by ONE Ctrl+Z across BOTH stores. These tests drive the
// forward action + its undo/redo branches + the applyProjectUndo/Redo cross-store side.

function makeCount(page: number, name: string, seq: number, categoryId = 'cat-1'): CountMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'count',
    page,
    name,
    categoryId,
    color: '#dc2626',
    sequence: seq,
    point: { x: seq * 10, y: seq * 10 },
    createdAt: Date.now() + seq
  }
}

function makeArea(page: number, name: string, categoryId = 'cat-1'): AreaMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'area',
    page,
    name,
    categoryId,
    color: '#0078d4',
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ],
    createdAt: Date.now()
  }
}

function rate(material: number, labor: number, markup = 30): PriceEntry {
  return { material, labor, markup }
}

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    categoryItemOrder: {},
    undoStack: [],
    redoStack: []
  })
  useProjectStore.getState().reset()
})

describe('markupStore — renameGroup (single-type group)', () => {
  beforeEach(() => {
    // A 2-pin count group "A" in cat-1, across two pages, with a rate, a hidden entry,
    // and a persisted order slot.
    useMarkupStore.setState({
      pageMarkups: {
        1: [makeCount(1, 'A', 1), makeCount(1, 'A', 2)],
        2: [makeCount(2, 'A', 1)]
      },
      categoryItemOrder: { 'cat-1': ['A|count'] }
    })
    useProjectStore.setState({
      rates: { 'A|count': rate(10, 5) },
      hiddenItemNames: ['A|cat-1'],
      hiddenItemSet: new Set(['A|cat-1'])
    })
  })

  it('flips .name on EVERY markup in the group across all pages (D-03)', () => {
    useMarkupStore.getState().renameGroup('A', 'B')

    const all = Object.values(useMarkupStore.getState().pageMarkups).flat()
    expect(all.every((m) => m.name === 'B')).toBe(true)
    expect(all.some((m) => m.name === 'A')).toBe(false)
    expect(all).toHaveLength(3) // no markups lost
  })

  it('re-keys rates `A|count`→`B|count`, carrying the entry, dropping the old key', () => {
    useMarkupStore.getState().renameGroup('A', 'B')

    const { rates } = useProjectStore.getState()
    expect(rates['B|count']).toEqual(rate(10, 5))
    expect(rates['A|count']).toBeUndefined()
  })

  it('re-keys the composite hidden key `A|cat-1`→`B|cat-1` and rebuilds hiddenItemSet', () => {
    useMarkupStore.getState().renameGroup('A', 'B')

    const { hiddenItemNames, hiddenItemSet } = useProjectStore.getState()
    expect(hiddenItemNames).toEqual(['B|cat-1'])
    expect(hiddenItemSet.has('B|cat-1')).toBe(true)
    expect(hiddenItemSet.has('A|cat-1')).toBe(false)
  })

  it('re-keys categoryItemOrder `A|count`→`B|count`', () => {
    useMarkupStore.getState().renameGroup('A', 'B')

    expect(useMarkupStore.getState().categoryItemOrder['cat-1']).toEqual(['B|count'])
  })

  it('pushes exactly one rename-group command and clears redo', () => {
    useMarkupStore.getState().renameGroup('A', 'B')

    const { undoStack, redoStack } = useMarkupStore.getState()
    expect(undoStack).toHaveLength(1)
    expect(undoStack[0].type).toBe('rename-group')
    expect(redoStack).toHaveLength(0)
  })

  it('ONE undo() restores names + rate key + hidden key + order across both stores', () => {
    useMarkupStore.getState().renameGroup('A', 'B')
    useMarkupStore.getState().undo()

    const all = Object.values(useMarkupStore.getState().pageMarkups).flat()
    expect(all.every((m) => m.name === 'A')).toBe(true)

    const { rates, hiddenItemNames, hiddenItemSet } = useProjectStore.getState()
    expect(rates['A|count']).toEqual(rate(10, 5))
    expect(rates['B|count']).toBeUndefined()
    expect(hiddenItemNames).toEqual(['A|cat-1'])
    expect(hiddenItemSet.has('A|cat-1')).toBe(true)
    expect(useMarkupStore.getState().categoryItemOrder['cat-1']).toEqual(['A|count'])

    // Exactly one undo-stack entry consumed.
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
    expect(useMarkupStore.getState().redoStack).toHaveLength(1)
  })

  it('redo() after undo() re-applies the rename to both stores', () => {
    useMarkupStore.getState().renameGroup('A', 'B')
    useMarkupStore.getState().undo()
    useMarkupStore.getState().redo()

    const all = Object.values(useMarkupStore.getState().pageMarkups).flat()
    expect(all.every((m) => m.name === 'B')).toBe(true)
    expect(useProjectStore.getState().rates['B|count']).toEqual(rate(10, 5))
    expect(useProjectStore.getState().hiddenItemNames).toEqual(['B|cat-1'])
    expect(useMarkupStore.getState().categoryItemOrder['cat-1']).toEqual(['B|count'])
  })
})

describe('markupStore — renameGroup (multi-type group: count + area)', () => {
  beforeEach(() => {
    useMarkupStore.setState({
      pageMarkups: { 1: [makeCount(1, 'A', 1), makeArea(1, 'A')] },
      categoryItemOrder: { 'cat-1': ['A|count', 'A|area'] }
    })
    useProjectStore.setState({
      rates: { 'A|count': rate(10, 5), 'A|area': rate(20, 8) },
      hiddenItemNames: [],
      hiddenItemSet: new Set()
    })
  })

  it('re-keys BOTH types (count + area) and both order slots', () => {
    useMarkupStore.getState().renameGroup('A', 'B')

    const { rates } = useProjectStore.getState()
    expect(rates['B|count']).toEqual(rate(10, 5))
    expect(rates['B|area']).toEqual(rate(20, 8))
    expect(rates['A|count']).toBeUndefined()
    expect(rates['A|area']).toBeUndefined()
    expect(useMarkupStore.getState().categoryItemOrder['cat-1']).toEqual(['B|count', 'B|area'])
  })

  it('one undo() restores both type keys + both order slots', () => {
    useMarkupStore.getState().renameGroup('A', 'B')
    useMarkupStore.getState().undo()

    const { rates } = useProjectStore.getState()
    expect(rates['A|count']).toEqual(rate(10, 5))
    expect(rates['A|area']).toEqual(rate(20, 8))
    expect(rates['B|count']).toBeUndefined()
    expect(rates['B|area']).toBeUndefined()
    expect(useMarkupStore.getState().categoryItemOrder['cat-1']).toEqual(['A|count', 'A|area'])
  })
})

describe('markupStore — renameGroup (group spanning two categories, Pitfall 3)', () => {
  beforeEach(() => {
    // Same name "A" as a count in TWO categories. The rate key is category-independent
    // (one `A|count`), but hidden + order are per-category.
    useMarkupStore.setState({
      pageMarkups: { 1: [makeCount(1, 'A', 1, 'cat-1'), makeCount(1, 'A', 1, 'cat-2')] },
      categoryItemOrder: { 'cat-1': ['A|count'], 'cat-2': ['A|count'] }
    })
    useProjectStore.setState({
      rates: { 'A|count': rate(10, 5) },
      hiddenItemNames: ['A|cat-1', 'A|cat-2'],
      hiddenItemSet: new Set(['A|cat-1', 'A|cat-2'])
    })
  })

  it('re-keys the hidden composite PER category and the order in BOTH categories', () => {
    useMarkupStore.getState().renameGroup('A', 'B')

    expect(useProjectStore.getState().hiddenItemNames.sort()).toEqual(['B|cat-1', 'B|cat-2'])
    expect(useMarkupStore.getState().categoryItemOrder['cat-1']).toEqual(['B|count'])
    expect(useMarkupStore.getState().categoryItemOrder['cat-2']).toEqual(['B|count'])
    // Single category-independent rate key.
    expect(useProjectStore.getState().rates['B|count']).toEqual(rate(10, 5))
    expect(useProjectStore.getState().rates['A|count']).toBeUndefined()
  })

  it('one undo() restores both categories hidden + order', () => {
    useMarkupStore.getState().renameGroup('A', 'B')
    useMarkupStore.getState().undo()

    expect(useProjectStore.getState().hiddenItemNames.sort()).toEqual(['A|cat-1', 'A|cat-2'])
    expect(useMarkupStore.getState().categoryItemOrder['cat-1']).toEqual(['A|count'])
    expect(useMarkupStore.getState().categoryItemOrder['cat-2']).toEqual(['A|count'])
  })
})

describe('markupStore — renameGroup (partial side-tables)', () => {
  it('renames names even when NO rate/hidden/order entries exist (nothing to re-key)', () => {
    useMarkupStore.setState({
      pageMarkups: { 1: [makeCount(1, 'A', 1) as Markup] }
    })
    useProjectStore.setState({ rates: {}, hiddenItemNames: [], hiddenItemSet: new Set() })

    const result = useMarkupStore.getState().renameGroup('A', 'B')

    expect(result).toEqual({ ok: true })
    expect(useMarkupStore.getState().getMarkups(1)[0].name).toBe('B')
    // Undo still restores the name.
    useMarkupStore.getState().undo()
    expect(useMarkupStore.getState().getMarkups(1)[0].name).toBe('A')
  })

  it('trims the new name before applying (D-03)', () => {
    useMarkupStore.setState({
      pageMarkups: { 1: [makeCount(1, 'A', 1) as Markup] }
    })
    useProjectStore.setState({ rates: { 'A|count': rate(1, 1) }, hiddenItemNames: [], hiddenItemSet: new Set() })

    useMarkupStore.getState().renameGroup('A', '  B  ')

    expect(useMarkupStore.getState().getMarkups(1)[0].name).toBe('B')
    expect(useProjectStore.getState().rates['B|count']).toEqual(rate(1, 1))
  })
})
