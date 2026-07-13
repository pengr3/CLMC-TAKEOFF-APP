import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { aggregateBoq } from '@renderer/lib/boq-aggregator'
import type { AreaMarkup, CountMarkup, Category } from '@renderer/types/markup'

// /code-review 17 --fix — group move/copy/duplicate correctness (three findings that share
// the moveGroup rework):
//   ORDER-TOP  : append lands at the BOTTOM of a never-reordered category, not the top.
//   MOVE-HIDDEN: moveGroup re-keys the composite visibility key (no orphan, stays hidden).
//   MOVE-UNDO  : a group spanning categories restores each markup to its OWN category.

const CIVIL = 'cat-civil'
const FINISHES = 'cat-finishes'
const KITCHEN = 'cat-kitchen'

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
function makeCount(id: string, page: number, name: string, seq: number, categoryId: string): CountMarkup {
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
function namesInCategory(catName: string): string[] {
  const result = aggregateBoq({
    markups: useMarkupStore.getState().pageMarkups,
    pageScales: {},
    globalUnit: 'm',
    totalPages: 1,
    categoriesById: useMarkupStore.getState().categories as Record<string, { id: string; name: string }>,
    categoryOrder: useMarkupStore.getState().categoryOrder,
    categoryItemOrder: useMarkupStore.getState().categoryItemOrder,
    rates: {},
    getColorForName: () => null
  })
  return result.categories.find((c) => c.name === catName)?.items.map((i) => i.label) ?? []
}
function markupsNamed(name: string): AreaMarkup[] {
  return Object.values(useMarkupStore.getState().pageMarkups)
    .flat()
    .filter((m) => m.name === name) as AreaMarkup[]
}

beforeEach(() => {
  useMarkupStore.getState().reset()
  useProjectStore.getState().reset()
  useScaleStore.getState().reset()
  useViewerStore.setState({ currentPage: 1, totalPages: 1 })
})

describe('ORDER-TOP: move/duplicate append to the BOTTOM of a never-reordered category', () => {
  it('moveGroup into a populated-but-unordered category lands the moved row LAST', () => {
    // Finishes already holds a REAL "Tile" but was never drag-reordered (no order entry).
    useMarkupStore.setState({
      pageMarkups: {
        1: [makeCount('tile', 1, 'Tile', 1, FINISHES), makeCount('slab', 1, 'Slab', 1, CIVIL)]
      },
      categories: { [CIVIL]: cat(CIVIL, 'Civil', 0), [FINISHES]: cat(FINISHES, 'Finishes', 1) },
      categoryOrder: [CIVIL, FINISHES],
      categoryItemOrder: {}, // never reordered
      undoStack: [],
      redoStack: []
    })

    useMarkupStore.getState().moveGroup('Slab', 'Finishes')

    // Seeded to completeness (Tile first) then Slab appended — NOT [Slab, Tile].
    expect(useMarkupStore.getState().categoryItemOrder[FINISHES]).toEqual([
      'Tile|count',
      'Slab|count'
    ])
    expect(namesInCategory('Finishes')).toEqual(['Tile', 'Slab'])
  })

  it('duplicateGroup appends the copy BELOW the source in a never-reordered category', () => {
    useMarkupStore.setState({
      pageMarkups: {
        1: [makeCount('beam', 1, 'Beam', 1, CIVIL), makeCount('slab', 1, 'Slab', 1, CIVIL)]
      },
      categories: { [CIVIL]: cat(CIVIL, 'Civil', 0) },
      categoryOrder: [CIVIL],
      categoryItemOrder: {},
      undoStack: [],
      redoStack: []
    })

    useMarkupStore.getState().duplicateGroup('Slab')

    expect(useMarkupStore.getState().categoryItemOrder[CIVIL]).toEqual([
      'Beam|count',
      'Slab|count',
      'Slab (2)|count'
    ])
    expect(namesInCategory('Civil')).toEqual(['Beam', 'Slab', 'Slab (2)'])
  })
})

describe('MOVE-HIDDEN: moveGroup re-keys the composite visibility key (no orphan, stays hidden)', () => {
  beforeEach(() => {
    useMarkupStore.setState({
      pageMarkups: { 1: [makeArea('slab', 1, 'Slab', CIVIL)] },
      categories: { [CIVIL]: cat(CIVIL, 'Civil', 0), [FINISHES]: cat(FINISHES, 'Finishes', 1) },
      categoryOrder: [CIVIL, FINISHES],
      categoryItemOrder: { [CIVIL]: ['Slab|area'] },
      undoStack: [],
      redoStack: []
    })
    useProjectStore.setState({
      hiddenItemNames: ['Slab|cat-civil'],
      hiddenItemSet: new Set(['Slab|cat-civil'])
    })
  })

  it('migrates the hidden key to the target category and leaves no orphan', () => {
    useMarkupStore.getState().moveGroup('Slab', 'Finishes')

    const ps = useProjectStore.getState()
    expect(ps.hiddenItemSet.has('Slab|cat-finishes')).toBe(true) // still hidden
    expect(ps.hiddenItemSet.has('Slab|cat-civil')).toBe(false) // orphan removed
    expect(ps.hiddenItemNames).toEqual(['Slab|cat-finishes'])
  })

  it('ONE undo() restores the original hidden key (cross-store atomic)', () => {
    useMarkupStore.getState().moveGroup('Slab', 'Finishes')
    useMarkupStore.getState().undo()

    expect(useProjectStore.getState().hiddenItemNames).toEqual(['Slab|cat-civil'])
    expect(useProjectStore.getState().hiddenItemSet.has('Slab|cat-civil')).toBe(true)
  })
})

describe('MOVE-UNDO: a group spanning categories restores each markup to its OWN category', () => {
  it('undo re-homes per-markup, not all to the first source category', () => {
    useMarkupStore.setState({
      pageMarkups: {
        1: [makeArea('slab-civil', 1, 'Slab', CIVIL)],
        2: [makeArea('slab-kitchen', 2, 'Slab', KITCHEN)]
      },
      categories: {
        [CIVIL]: cat(CIVIL, 'Civil', 0),
        [KITCHEN]: cat(KITCHEN, 'Kitchen', 1),
        [FINISHES]: cat(FINISHES, 'Finishes', 2)
      },
      categoryOrder: [CIVIL, KITCHEN, FINISHES],
      categoryItemOrder: {},
      undoStack: [],
      redoStack: []
    })

    useMarkupStore.getState().moveGroup('Slab', 'Finishes')
    expect(markupsNamed('Slab').every((m) => m.categoryId === FINISHES)).toBe(true)

    useMarkupStore.getState().undo()

    const byId = Object.fromEntries(markupsNamed('Slab').map((m) => [m.id, m.categoryId]))
    expect(byId['slab-civil']).toBe(CIVIL)
    expect(byId['slab-kitchen']).toBe(KITCHEN) // NOT wrongly re-homed to CIVIL
  })
})
