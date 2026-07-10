import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { AreaMarkup, Category } from '@renderer/types/markup'
import type { PriceEntry } from '@renderer/lib/boq-types'

// Phase 17-04 Task 1 — Req 3 (D-06): moveGroup reassigns categoryId on EVERY markup in a
// group to the chosen category; name / quantity / color / rate (the category-INDEPENDENT
// `name|type` key) are unchanged; the row LEAVES its source category's manual order and
// APPENDS to the target's; ONE Ctrl+Z restores categoryId + order. Single-store command
// (no projectStore payload — rates untouched).

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

function rate(material: number, labor: number, markup = 30): PriceEntry {
  return { material, labor, markup }
}

const CIVIL = 'cat-civil'
const FINISHES = 'cat-finishes'

beforeEach(() => {
  // "Slab" is an area group living in Civil across two pages; Finishes already holds a
  // "Tile" area (so it has a pre-existing manual order to append onto).
  useMarkupStore.setState({
    pageMarkups: {
      1: [makeArea('slab-1', 1, 'Slab', CIVIL)],
      2: [makeArea('slab-2', 2, 'Slab', CIVIL)]
    },
    categories: {
      [CIVIL]: cat(CIVIL, 'Civil', 0),
      [FINISHES]: cat(FINISHES, 'Finishes', 1)
    },
    categoryOrder: [CIVIL, FINISHES],
    categoryItemOrder: { [CIVIL]: ['Slab|area'], [FINISHES]: ['Tile|area'] },
    undoStack: [],
    redoStack: []
  })
  useProjectStore.getState().reset()
  useProjectStore.setState({
    rates: { 'Slab|area': rate(20, 8), 'Tile|area': rate(5, 2) }
  })
})

describe('markupStore — moveGroup (Civil → Finishes)', () => {
  it('reassigns categoryId to the target on EVERY markup in the group (all pages)', () => {
    useMarkupStore.getState().moveGroup('Slab', 'Finishes')

    const slabs = Object.values(useMarkupStore.getState().pageMarkups)
      .flat()
      .filter((m) => m.name === 'Slab')
    expect(slabs).toHaveLength(2)
    expect(slabs.every((m) => m.categoryId === FINISHES)).toBe(true)
  })

  it('leaves quantity (geometry) and the category-independent rate untouched (D-06)', () => {
    const beforePoints = (useMarkupStore.getState().getMarkups(1)[0] as AreaMarkup).points

    useMarkupStore.getState().moveGroup('Slab', 'Finishes')

    // Geometry (→ quantity) is unchanged: the moved markup keeps identical points.
    const afterPoints = (useMarkupStore.getState().getMarkups(1)[0] as AreaMarkup).points
    expect(afterPoints).toEqual(beforePoints)
    // Rate key is `name|type`, category-independent → not re-keyed by a move.
    expect(useProjectStore.getState().rates['Slab|area']).toEqual(rate(20, 8))
  })

  it("appends 'Slab|area' to the target order and removes it from the source order", () => {
    useMarkupStore.getState().moveGroup('Slab', 'Finishes')

    const order = useMarkupStore.getState().categoryItemOrder
    expect(order[FINISHES]).toEqual(['Tile|area', 'Slab|area'])
    expect(order[CIVIL]).toEqual([])
  })

  it("pushes exactly one 'move-group' command and clears redo", () => {
    useMarkupStore.getState().moveGroup('Slab', 'Finishes')

    const { undoStack, redoStack } = useMarkupStore.getState()
    expect(undoStack).toHaveLength(1)
    expect(undoStack[0].type).toBe('move-group')
    expect(redoStack).toHaveLength(0)
  })

  it('ONE undo() restores the original categoryId AND the source/target order', () => {
    useMarkupStore.getState().moveGroup('Slab', 'Finishes')
    useMarkupStore.getState().undo()

    const slabs = Object.values(useMarkupStore.getState().pageMarkups)
      .flat()
      .filter((m) => m.name === 'Slab')
    expect(slabs.every((m) => m.categoryId === CIVIL)).toBe(true)

    const order = useMarkupStore.getState().categoryItemOrder
    expect(order[CIVIL]).toEqual(['Slab|area'])
    expect(order[FINISHES]).toEqual(['Tile|area'])

    // Exactly one undo-stack entry consumed.
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
    expect(useMarkupStore.getState().redoStack).toHaveLength(1)
  })

  it('redo() re-applies the move to both categoryId and order', () => {
    useMarkupStore.getState().moveGroup('Slab', 'Finishes')
    useMarkupStore.getState().undo()
    useMarkupStore.getState().redo()

    const slabs = Object.values(useMarkupStore.getState().pageMarkups)
      .flat()
      .filter((m) => m.name === 'Slab')
    expect(slabs.every((m) => m.categoryId === FINISHES)).toBe(true)
    expect(useMarkupStore.getState().categoryItemOrder[FINISHES]).toEqual(['Tile|area', 'Slab|area'])
    expect(useMarkupStore.getState().categoryItemOrder[CIVIL]).toEqual([])
  })
})

describe('markupStore — moveGroup (target category resolved before set)', () => {
  it('creates a brand-new target category (getOrCreateCategory) and lands the group there', () => {
    useMarkupStore.getState().moveGroup('Slab', 'Structural')

    // A new category named "Structural" now exists and the group carries its id.
    const structural = useMarkupStore.getState().findCategoryByName('Structural')
    expect(structural).not.toBeNull()
    const slabs = Object.values(useMarkupStore.getState().pageMarkups)
      .flat()
      .filter((m) => m.name === 'Slab')
    expect(slabs.every((m) => m.categoryId === structural!.id)).toBe(true)
    // The moved key is appended to the (freshly created) target order.
    expect(useMarkupStore.getState().categoryItemOrder[structural!.id]).toEqual(['Slab|area'])
    expect(useMarkupStore.getState().categoryItemOrder[CIVIL]).toEqual([])
  })

  it('is a defensive no-op (no command) when no group of that name exists', () => {
    useMarkupStore.getState().moveGroup('Nonexistent', 'Finishes')
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
  })
})
