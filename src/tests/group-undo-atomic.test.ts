import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { CountMarkup, AreaMarkup } from '@renderer/types/markup'
import type { PriceEntry } from '@renderer/lib/boq-types'

// Phase 17-02 Task 3 — the phase's HIGHEST-RISK guarantee gets a dedicated proof:
// ONE Ctrl+Z must revert a rename ATOMICALLY across BOTH markupStore (names + order)
// AND projectStore (rates + hidden), consuming exactly ONE undo-stack entry (not two
// separate steps). This plan covers RENAME; 17-04 extends this file with move/copy/dup.
//
// The proof deep-captures a `before` snapshot of both stores, renames, then asserts a
// single undo() makes both stores deep-equal `before` again (and a single redo() re-applies
// it). structuredClone is used so the assertion cannot be fooled by any accidental
// in-place mutation of the captured references.

function makeCount(page: number, name: string, seq: number, categoryId = 'cat-1'): CountMarkup {
  return {
    id: `count-${page}-${seq}`,
    type: 'count',
    page,
    name,
    categoryId,
    color: '#dc2626',
    sequence: seq,
    point: { x: seq * 10, y: seq * 10 },
    createdAt: 1000 + page * 10 + seq
  }
}

function makeArea(page: number, name: string, categoryId = 'cat-1'): AreaMarkup {
  return {
    id: `area-${page}`,
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
    createdAt: 2000 + page
  }
}

function rate(material: number, labor: number, markup = 30): PriceEntry {
  return { material, labor, markup }
}

interface CrossStoreSnapshot {
  pageMarkups: Record<number, unknown>
  categoryItemOrder: Record<string, string[]>
  rates: Record<string, PriceEntry>
  hiddenItemNames: string[]
  hiddenItemSet: Set<string>
}

function snapshotBothStores(): CrossStoreSnapshot {
  const m = useMarkupStore.getState()
  const p = useProjectStore.getState()
  return structuredClone({
    pageMarkups: m.pageMarkups,
    categoryItemOrder: m.categoryItemOrder,
    rates: p.rates,
    hiddenItemNames: p.hiddenItemNames,
    hiddenItemSet: p.hiddenItemSet
  })
}

beforeEach(() => {
  // A multi-type group "A" (count + area) across TWO pages, with rates for both types,
  // a composite hidden entry for cat-1, and a persisted per-category order.
  useMarkupStore.setState({
    pageMarkups: {
      1: [makeCount(1, 'A', 1), makeArea(1, 'A')],
      2: [makeCount(2, 'A', 1)]
    },
    categories: {},
    categoryOrder: [],
    categoryItemOrder: { 'cat-1': ['A|count', 'A|area'] },
    undoStack: [],
    redoStack: []
  })
  useProjectStore.getState().reset()
  useProjectStore.setState({
    rates: { 'A|count': rate(10, 5), 'A|area': rate(20, 8) },
    hiddenItemNames: ['A|cat-1'],
    hiddenItemSet: new Set(['A|cat-1'])
  })
})

describe('group-undo-atomic — rename reverts across BOTH stores with ONE Ctrl+Z', () => {
  it('one undo() makes markupStore AND projectStore deep-equal the pre-rename snapshot', () => {
    const before = snapshotBothStores()

    useMarkupStore.getState().renameGroup('A', 'B')
    // Sanity: the rename actually moved both stores off `before`.
    expect(useProjectStore.getState().rates['B|count']).toEqual(rate(10, 5))
    expect(useProjectStore.getState().rates['A|count']).toBeUndefined()

    useMarkupStore.getState().undo()

    const afterUndo = snapshotBothStores()
    // The WHOLE cross-store state — names, order, rate keys+entries, hidden keys, and the
    // derived hiddenItemSet — matches the pre-rename snapshot exactly.
    expect(afterUndo).toEqual(before)
  })

  it('consumes EXACTLY ONE undo-stack entry (atomic, not two separate steps)', () => {
    useMarkupStore.getState().renameGroup('A', 'B')
    expect(useMarkupStore.getState().undoStack).toHaveLength(1)
    expect(useMarkupStore.getState().redoStack).toHaveLength(0)

    useMarkupStore.getState().undo()

    // A single undo() moved the stacks by exactly one entry each — the whole cross-store
    // rename is ONE unit of history, not a rate-step + a name-step.
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
    expect(useMarkupStore.getState().redoStack).toHaveLength(1)
  })

  it('one redo() re-applies the rename to BOTH stores (deep-equal the post-rename snapshot)', () => {
    useMarkupStore.getState().renameGroup('A', 'B')
    const afterRename = snapshotBothStores()

    useMarkupStore.getState().undo()
    useMarkupStore.getState().redo()

    const afterRedo = snapshotBothStores()
    expect(afterRedo).toEqual(afterRename)
    // And the stacks moved by exactly one entry on redo.
    expect(useMarkupStore.getState().undoStack).toHaveLength(1)
    expect(useMarkupStore.getState().redoStack).toHaveLength(0)
  })

  it('a full undo→redo→undo cycle is stable (both stores land on the pre-rename snapshot)', () => {
    const before = snapshotBothStores()

    useMarkupStore.getState().renameGroup('A', 'B')
    useMarkupStore.getState().undo()
    useMarkupStore.getState().redo()
    useMarkupStore.getState().undo()

    expect(snapshotBothStores()).toEqual(before)
  })
})

// Phase 17-04 Task 3 — extend the ONE-Ctrl+Z atomicity proof to move / copy / duplicate.
// Move is SINGLE-store (categoryId + order); Copy/Duplicate are CROSS-store (new markups in
// markupStore + a fresh blank rate in projectStore). Each case captures a `before`/`after`
// deep-snapshot of BOTH stores and asserts a single undo() (and where relevant redo())
// moves them together, consuming EXACTLY ONE undo-stack entry.

describe('group-undo-atomic — moveGroup reverts categoryId + order with ONE Ctrl+Z', () => {
  beforeEach(() => {
    // "A" lives in Civil (cat-1); Finishes (cat-2) exists by name with a pre-existing order,
    // so getOrCreateCategory('Finishes') resolves it and undo leaves no phantom order key.
    useMarkupStore.setState({
      pageMarkups: {
        1: [makeCount(1, 'A', 1, 'cat-1'), makeArea(1, 'A', 'cat-1')],
        2: [makeCount(2, 'A', 1, 'cat-1')]
      },
      categories: {
        'cat-1': { id: 'cat-1', name: 'Civil', color: '#111111', paletteIndex: 0 },
        'cat-2': { id: 'cat-2', name: 'Finishes', color: '#222222', paletteIndex: 1 }
      },
      categoryOrder: ['cat-1', 'cat-2'],
      categoryItemOrder: { 'cat-1': ['A|count', 'A|area'], 'cat-2': ['Tile|area'] },
      undoStack: [],
      redoStack: []
    })
    useProjectStore.getState().reset()
    useProjectStore.setState({
      rates: { 'A|count': rate(10, 5), 'A|area': rate(20, 8) },
      hiddenItemNames: ['A|cat-1'],
      hiddenItemSet: new Set(['A|cat-1'])
    })
  })

  it('one undo() restores both stores; projectStore rates are untouched throughout', () => {
    const before = snapshotBothStores()

    useMarkupStore.getState().moveGroup('A', 'Finishes')
    // A move never touches rates (the rate key is the category-independent name|type).
    expect(useProjectStore.getState().rates).toEqual(before.rates)

    useMarkupStore.getState().undo()

    expect(snapshotBothStores()).toEqual(before)
  })

  it('consumes EXACTLY ONE undo-stack entry', () => {
    useMarkupStore.getState().moveGroup('A', 'Finishes')
    expect(useMarkupStore.getState().undoStack).toHaveLength(1)
    expect(useMarkupStore.getState().redoStack).toHaveLength(0)

    useMarkupStore.getState().undo()

    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
    expect(useMarkupStore.getState().redoStack).toHaveLength(1)
  })
})

describe('group-undo-atomic — copyGroup reverts markups + rate with ONE Ctrl+Z', () => {
  beforeEach(() => {
    // Copy "A" (Civil) into Finishes, which pre-exists with an order → no phantom key on undo.
    useMarkupStore.setState({
      pageMarkups: {
        1: [makeCount(1, 'A', 1, 'cat-1'), makeArea(1, 'A', 'cat-1')],
        2: [makeCount(2, 'A', 1, 'cat-1')]
      },
      categories: {
        'cat-1': { id: 'cat-1', name: 'Civil', color: '#111111', paletteIndex: 0 },
        'cat-2': { id: 'cat-2', name: 'Finishes', color: '#222222', paletteIndex: 1 }
      },
      categoryOrder: ['cat-1', 'cat-2'],
      categoryItemOrder: { 'cat-1': ['A|count', 'A|area'], 'cat-2': ['Tile|area'] },
      undoStack: [],
      redoStack: []
    })
    useProjectStore.getState().reset()
    useProjectStore.setState({
      rates: { 'A|count': rate(10, 5), 'A|area': rate(20, 8) },
      hiddenItemNames: ['A|cat-1'],
      hiddenItemSet: new Set(['A|cat-1'])
    })
  })

  it('one undo() removes the copied markups AND their rate; both stores deep-equal pre-copy', () => {
    const before = snapshotBothStores()

    useMarkupStore.getState().copyGroup('A', 'Finishes')
    // Sanity: the copy landed in BOTH stores (new markups + a blank rate).
    expect(useProjectStore.getState().rates['A (2)|count']).toEqual(rate(0, 0))
    expect(
      Object.values(useMarkupStore.getState().pageMarkups)
        .flat()
        .some((m) => m.name === 'A (2)')
    ).toBe(true)

    useMarkupStore.getState().undo()

    expect(snapshotBothStores()).toEqual(before)
  })

  it('consumes EXACTLY ONE undo-stack entry and redo() re-adds markups + rate', () => {
    useMarkupStore.getState().copyGroup('A', 'Finishes')
    const afterCopy = snapshotBothStores()
    expect(useMarkupStore.getState().undoStack).toHaveLength(1)

    useMarkupStore.getState().undo()
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
    expect(useMarkupStore.getState().redoStack).toHaveLength(1)

    useMarkupStore.getState().redo()
    // redo re-adds the exact snapshots + rate → both stores match the post-copy snapshot.
    expect(snapshotBothStores()).toEqual(afterCopy)
    expect(useMarkupStore.getState().undoStack).toHaveLength(1)
    expect(useMarkupStore.getState().redoStack).toHaveLength(0)
  })
})

describe('group-undo-atomic — duplicateGroup reverts markups + rate with ONE Ctrl+Z', () => {
  // Uses the top-level "A" fixture (categoryItemOrder cat-1: ['A|count','A|area']). Duplicate
  // targets the SOURCE category (cat-1), which already has an order → no phantom key on undo.
  it('source group is unchanged (no doubling) and one undo() reverts BOTH stores', () => {
    const before = snapshotBothStores()
    const sourceCountBefore = Object.values(useMarkupStore.getState().pageMarkups)
      .flat()
      .filter((m) => m.name === 'A').length

    useMarkupStore.getState().duplicateGroup('A')

    // Distinct bucket: the source "A" group is untouched — same number of markups.
    const sourceCountAfter = Object.values(useMarkupStore.getState().pageMarkups)
      .flat()
      .filter((m) => m.name === 'A').length
    expect(sourceCountAfter).toBe(sourceCountBefore)
    expect(useProjectStore.getState().rates['A (2)|count']).toEqual(rate(0, 0))

    useMarkupStore.getState().undo()

    expect(snapshotBothStores()).toEqual(before)
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
    expect(useMarkupStore.getState().redoStack).toHaveLength(1)
  })
})
