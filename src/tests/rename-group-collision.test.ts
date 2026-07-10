import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { CountMarkup, AreaMarkup } from '@renderer/types/markup'
import type { PriceEntry } from '@renderer/lib/boq-types'

// Phase 17-02 Req 1 (D-04): rename onto an existing SAME-TYPE group is BLOCKED with a
// not-ok sentinel and ZERO store writes (no merge). A same-name under a DIFFERENT type is
// allowed; a blank/whitespace name is rejected. The "zero writes" guarantee is proven by
// asserting names + rates + hidden are byte-identical AND projectStore.isDirty stays false.

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
  useProjectStore.getState().reset() // isDirty → false, rates/hidden cleared
})

describe('markupStore — renameGroup collision BLOCK (D-04, zero writes)', () => {
  it('blocks when a SAME-TYPE group named newName exists outside the rename set', () => {
    useMarkupStore.setState({
      pageMarkups: { 1: [makeCount(1, 'A', 1), makeCount(1, 'B', 1)] }
    })
    useProjectStore.setState({
      rates: { 'A|count': rate(1, 1), 'B|count': rate(2, 2) },
      hiddenItemNames: ['A|cat-1', 'B|cat-1'],
      hiddenItemSet: new Set(['A|cat-1', 'B|cat-1'])
    })

    const result = useMarkupStore.getState().renameGroup('A', 'B')

    expect(result).toEqual({ ok: false })
    // Names unchanged.
    const names = useMarkupStore.getState().getMarkups(1).map((m) => m.name).sort()
    expect(names).toEqual(['A', 'B'])
    // Rates unchanged (no merge, no re-key).
    expect(useProjectStore.getState().rates).toEqual({ 'A|count': rate(1, 1), 'B|count': rate(2, 2) })
    // Hidden unchanged.
    expect(useProjectStore.getState().hiddenItemNames.sort()).toEqual(['A|cat-1', 'B|cat-1'])
    // No command pushed.
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
    // ZERO writes → project never marked dirty.
    expect(useProjectStore.getState().isDirty).toBe(false)
  })

  it('blocks category-INDEPENDENTLY: same-type "B" in ANOTHER category still collides', () => {
    useMarkupStore.setState({
      pageMarkups: { 1: [makeCount(1, 'A', 1, 'cat-1'), makeCount(1, 'B', 1, 'cat-2')] }
    })
    useProjectStore.setState({
      rates: { 'A|count': rate(1, 1), 'B|count': rate(2, 2) },
      hiddenItemNames: [],
      hiddenItemSet: new Set()
    })

    const result = useMarkupStore.getState().renameGroup('A', 'B')

    expect(result).toEqual({ ok: false })
    expect(useMarkupStore.getState().getMarkups(1).map((m) => m.name).sort()).toEqual(['A', 'B'])
    expect(useProjectStore.getState().rates['A|count']).toEqual(rate(1, 1))
    expect(useProjectStore.getState().isDirty).toBe(false)
  })

  it('does NOT block when the same-name "B" is under a DIFFERENT type (no bucket merge)', () => {
    // "A" is a count; "B" exists only as an area → renaming the count A→B is allowed.
    useMarkupStore.setState({
      pageMarkups: { 1: [makeCount(1, 'A', 1), makeArea(1, 'B')] }
    })
    useProjectStore.setState({
      rates: { 'A|count': rate(1, 1), 'B|area': rate(3, 3) },
      hiddenItemNames: [],
      hiddenItemSet: new Set()
    })

    const result = useMarkupStore.getState().renameGroup('A', 'B')

    expect(result).toEqual({ ok: true })
    // The count is now "B"; the area "B" is untouched → count "B" + area "B" coexist.
    const counts = useMarkupStore.getState().getMarkups(1).filter((m) => m.type === 'count')
    expect(counts[0].name).toBe('B')
    expect(useProjectStore.getState().rates['B|count']).toEqual(rate(1, 1))
    expect(useProjectStore.getState().rates['B|area']).toEqual(rate(3, 3)) // area rate untouched
    expect(useProjectStore.getState().rates['A|count']).toBeUndefined()
  })

  it('rejects a blank / whitespace-only name with zero writes (D-03)', () => {
    useMarkupStore.setState({
      pageMarkups: { 1: [makeCount(1, 'A', 1)] }
    })
    useProjectStore.setState({
      rates: { 'A|count': rate(1, 1) },
      hiddenItemNames: [],
      hiddenItemSet: new Set()
    })

    expect(useMarkupStore.getState().renameGroup('A', '')).toEqual({ ok: false })
    expect(useMarkupStore.getState().renameGroup('A', '   ')).toEqual({ ok: false })

    expect(useMarkupStore.getState().getMarkups(1)[0].name).toBe('A')
    expect(useProjectStore.getState().rates).toEqual({ 'A|count': rate(1, 1) })
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
    expect(useProjectStore.getState().isDirty).toBe(false)
  })

  it('returns ok:false with no writes when no group named oldName exists', () => {
    useMarkupStore.setState({ pageMarkups: { 1: [makeCount(1, 'A', 1)] } })

    const result = useMarkupStore.getState().renameGroup('DOES-NOT-EXIST', 'B')

    expect(result).toEqual({ ok: false })
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
    expect(useProjectStore.getState().isDirty).toBe(false)
  })
})
