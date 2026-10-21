import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { AreaMarkup, CountMarkup, Category } from '@renderer/types/markup'
import type { PriceEntry } from '@renderer/lib/boq-types'

// Phase 17-04 Task 2 — Req 4 (D-07, Copy) + Req 5 (D-08, Duplicate): copyGroup /
// duplicateGroup build INDEPENDENT snapshots (fresh ids, deep-cloned geometry, fresh count
// sequences — Pitfall 6) under an auto-unique name with a fresh BLANK rate at a DISTINCT
// key. They never merge into the source (distinct name → distinct bucket, no quantity
// doubling). ONE Ctrl+Z removes BOTH the new markups AND their rate (cross-store atomic).

function cat(id: string, name: string, paletteIndex: number): Category {
  return { id, name, color: '#123456', paletteIndex }
}

function makeArea(id: string, page: number, name: string, categoryId: string): AreaMarkup {
  return {
    id,
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

function makeCount(
  id: string,
  page: number,
  name: string,
  seq: number,
  categoryId: string
): CountMarkup {
  return {
    id,
    type: 'count',
    page,
    name,
    categoryId,
    color: '#dc2626',
    sequence: seq,
    point: { x: seq * 10, y: seq * 10 },
    createdAt: 1000 + seq
  }
}

function rate(material: number, labor: number, markup = 30): PriceEntry {
  return { material, labor, markup }
}

const CIVIL = 'cat-civil'
const FINISHES = 'cat-finishes'

const BLANK = { material: 0, labor: 0, markup: 30 } // DEFAULT_MARKUP_PCT = 30

function markupsNamed(name: string): CountMarkup[] | AreaMarkup[] {
  return Object.values(useMarkupStore.getState().pageMarkups)
    .flat()
    .filter((m) => m.name === name) as never
}

describe('markupStore — copyGroup (Civil → Finishes)', () => {
  beforeEach(() => {
    // "Slab" is an area group in Civil across two pages; Finishes already holds a "Tile".
    useMarkupStore.setState({
      pageMarkups: {
        1: [makeArea('slab-1', 1, 'Slab', CIVIL)],
        2: [makeArea('slab-2', 2, 'Slab', CIVIL)]
      },
      categories: { [CIVIL]: cat(CIVIL, 'Civil', 0), [FINISHES]: cat(FINISHES, 'Finishes', 1) },
      categoryOrder: [CIVIL, FINISHES],
      categoryItemOrder: { [CIVIL]: ['Slab|area'], [FINISHES]: ['Tile|area'] },
      undoStack: [],
      redoStack: []
    })
    useProjectStore.getState().reset()
    useProjectStore.setState({ rates: { 'Slab|area': rate(20, 8), 'Tile|area': rate(5, 2) } })
  })

  it('creates an auto-named "Slab (2)" group under the target category (all pages)', () => {
    useMarkupStore.getState().copyGroup('Slab', 'Finishes')

    const copies = markupsNamed('Slab (2)')
    expect(copies).toHaveLength(2)
    expect(copies.every((m) => m.categoryId === FINISHES)).toBe(true)
    // Source is untouched (still 2 "Slab" markups in Civil).
    const source = markupsNamed('Slab')
    expect(source).toHaveLength(2)
    expect(source.every((m) => m.categoryId === CIVIL)).toBe(true)
  })

  it('gives the copy the SAME geometry (→ quantity) but INDEPENDENT array identities', () => {
    const sourcePoints = (useMarkupStore.getState().getMarkups(1)[0] as AreaMarkup).points

    useMarkupStore.getState().copyGroup('Slab', 'Finishes')

    const copyP1 = markupsNamed('Slab (2)').find((m) => m.page === 1) as AreaMarkup
    expect(copyP1.points).toEqual(sourcePoints) // identical coordinates
    expect(copyP1.points).not.toBe(sourcePoints) // brand-new array (independent snapshot)
    expect(copyP1.id).not.toBe('slab-1') // fresh id
  })

  it('seeds a fresh BLANK rate at a DISTINCT key and leaves the source rate intact', () => {
    useMarkupStore.getState().copyGroup('Slab', 'Finishes')

    const { rates } = useProjectStore.getState()
    expect(rates['Slab (2)|area']).toEqual({ ...BLANK, basis: 'm²', review: 'reviewed' })
    expect(rates['Slab|area']).toEqual(rate(20, 8)) // source rate NOT copied/merged
  })

  it('appends the new key to the target order and pushes one copy-group command', () => {
    useMarkupStore.getState().copyGroup('Slab', 'Finishes')

    expect(useMarkupStore.getState().categoryItemOrder[FINISHES]).toEqual([
      'Tile|area',
      'Slab (2)|area'
    ])
    const { undoStack, redoStack } = useMarkupStore.getState()
    expect(undoStack).toHaveLength(1)
    expect(undoStack[0].type).toBe('copy-group')
    expect(redoStack).toHaveLength(0)
  })

  it('is INDEPENDENT: editing the source geometry does not change the copy', () => {
    useMarkupStore.getState().copyGroup('Slab', 'Finishes')
    const copyBefore = structuredClone(
      (markupsNamed('Slab (2)').find((m) => m.page === 1) as AreaMarkup).points
    )

    // Mutate the SOURCE "Slab" on page 1 (drag a vertex far away).
    useMarkupStore.getState().moveVertex('slab-1', 1, 0, { x: 999, y: 999 })

    const copyAfter = (markupsNamed('Slab (2)').find((m) => m.page === 1) as AreaMarkup).points
    expect(copyAfter).toEqual(copyBefore) // copy untouched by the source edit
  })

  it('ONE undo() removes BOTH the copied markups AND their rate (cross-store)', () => {
    useMarkupStore.getState().copyGroup('Slab', 'Finishes')
    useMarkupStore.getState().undo()

    expect(markupsNamed('Slab (2)')).toHaveLength(0)
    expect(useProjectStore.getState().rates['Slab (2)|area']).toBeUndefined()
    // Source survives; target order back to just "Tile".
    expect(markupsNamed('Slab')).toHaveLength(2)
    expect(useProjectStore.getState().rates['Slab|area']).toEqual(rate(20, 8))
    expect(useMarkupStore.getState().categoryItemOrder[FINISHES]).toEqual(['Tile|area'])
    // Exactly one undo-stack entry consumed.
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
    expect(useMarkupStore.getState().redoStack).toHaveLength(1)
  })
})

describe('markupStore — duplicateGroup (in place, same category)', () => {
  beforeEach(() => {
    // A "Slab" COUNT group in Civil on page 1 with NON-1-based sequences (5, 9) so a fresh
    // per-page 1..k assignment on the copy is observable (Pitfall 6).
    useMarkupStore.setState({
      pageMarkups: {
        1: [makeCount('c5', 1, 'Slab', 5, CIVIL), makeCount('c9', 1, 'Slab', 9, CIVIL)]
      },
      categories: { [CIVIL]: cat(CIVIL, 'Civil', 0) },
      categoryOrder: [CIVIL],
      categoryItemOrder: { [CIVIL]: ['Slab|count'] },
      undoStack: [],
      redoStack: []
    })
    useProjectStore.getState().reset()
    useProjectStore.setState({ rates: { 'Slab|count': rate(3, 1) } })
  })

  it('creates "Slab (2)" in the SAME category without merging into the source', () => {
    useMarkupStore.getState().duplicateGroup('Slab')

    const copies = markupsNamed('Slab (2)')
    expect(copies).toHaveLength(2)
    expect(copies.every((m) => m.categoryId === CIVIL)).toBe(true)
    // Distinct bucket: source "Slab" quantity (pin count) is UNCHANGED — no doubling.
    const source = markupsNamed('Slab') as CountMarkup[]
    expect(source).toHaveLength(2)
    expect(source.map((m) => m.sequence).sort((a, b) => a - b)).toEqual([5, 9])
  })

  it('assigns FRESH per-page count sequences to the copy (Pitfall 6), not the source values', () => {
    useMarkupStore.getState().duplicateGroup('Slab')

    const copySeqs = (markupsNamed('Slab (2)') as CountMarkup[])
      .map((m) => m.sequence)
      .sort((a, b) => a - b)
    expect(copySeqs).toEqual([1, 2]) // fresh 1..k, NOT the cloned 5/9
  })

  it('seeds a fresh BLANK rate at "Slab (2)|count" and appends to the source category order', () => {
    useMarkupStore.getState().duplicateGroup('Slab')

    expect(useProjectStore.getState().rates['Slab (2)|count']).toEqual({ ...BLANK, basis: 'ea', review: 'reviewed' })
    expect(useProjectStore.getState().rates['Slab|count']).toEqual(rate(3, 1))
    expect(useMarkupStore.getState().categoryItemOrder[CIVIL]).toEqual([
      'Slab|count',
      'Slab (2)|count'
    ])
  })

  it('pushes exactly one duplicate-group command and ONE undo() reverts both stores', () => {
    useMarkupStore.getState().duplicateGroup('Slab')
    expect(useMarkupStore.getState().undoStack[0].type).toBe('duplicate-group')

    useMarkupStore.getState().undo()

    expect(markupsNamed('Slab (2)')).toHaveLength(0)
    expect(useProjectStore.getState().rates['Slab (2)|count']).toBeUndefined()
    expect(markupsNamed('Slab')).toHaveLength(2) // source intact
    expect(useMarkupStore.getState().categoryItemOrder[CIVIL]).toEqual(['Slab|count'])
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
  })
})
