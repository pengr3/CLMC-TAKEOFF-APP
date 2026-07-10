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
