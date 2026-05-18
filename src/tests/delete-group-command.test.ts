import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import type { CountMarkup, Markup } from '@renderer/types/markup'

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

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
})

describe('markupStore — deleteGroup command', () => {
  it('deleteGroup([markupA, markupB]) removes both markups from their page', () => {
    const a = makeCount(1, 'Outlet', 1)
    const b = makeCount(1, 'Outlet', 2)
    useMarkupStore.getState().placeMarkup(a)
    useMarkupStore.getState().placeMarkup(b)

    useMarkupStore.getState().deleteGroup([a as Markup, b as Markup])

    const page1 = useMarkupStore.getState().getMarkups(1)
    expect(page1.find((m) => m.id === a.id)).toBeUndefined()
    expect(page1.find((m) => m.id === b.id)).toBeUndefined()
  })

  it('deleteGroup pushes a single delete-group command onto undoStack (not one per markup)', () => {
    const a = makeCount(1, 'Outlet', 1)
    const b = makeCount(1, 'Outlet', 2)
    useMarkupStore.getState().placeMarkup(a)
    useMarkupStore.getState().placeMarkup(b)
    // 2 place commands present
    expect(useMarkupStore.getState().undoStack).toHaveLength(2)

    useMarkupStore.getState().deleteGroup([a as Markup, b as Markup])

    // Exactly one extra command (the delete-group), not two
    expect(useMarkupStore.getState().undoStack).toHaveLength(3)
    const top = useMarkupStore.getState().undoStack[2]
    expect(top.type).toBe('delete-group')
  })

  it('undo() after deleteGroup re-inserts both markups to their original page', () => {
    const a = makeCount(1, 'Outlet', 1)
    const b = makeCount(1, 'Outlet', 2)
    useMarkupStore.getState().placeMarkup(a)
    useMarkupStore.getState().placeMarkup(b)
    useMarkupStore.getState().deleteGroup([a as Markup, b as Markup])

    useMarkupStore.getState().undo()

    const page1 = useMarkupStore.getState().getMarkups(1)
    expect(page1.find((m) => m.id === a.id)).toBeDefined()
    expect(page1.find((m) => m.id === b.id)).toBeDefined()
  })

  it('after deleteGroup then undo(), redo() removes both markups again', () => {
    const a = makeCount(1, 'Outlet', 1)
    const b = makeCount(1, 'Outlet', 2)
    useMarkupStore.getState().placeMarkup(a)
    useMarkupStore.getState().placeMarkup(b)
    useMarkupStore.getState().deleteGroup([a as Markup, b as Markup])
    useMarkupStore.getState().undo()

    useMarkupStore.getState().redo()

    const page1 = useMarkupStore.getState().getMarkups(1)
    expect(page1.find((m) => m.id === a.id)).toBeUndefined()
    expect(page1.find((m) => m.id === b.id)).toBeUndefined()
  })

  it('deleteGroup across two pages removes both and undo re-inserts each to its correct page', () => {
    const a = makeCount(1, 'Outlet', 1) // page 1
    const b = makeCount(2, 'Outlet', 1) // page 2
    useMarkupStore.getState().placeMarkup(a)
    useMarkupStore.getState().placeMarkup(b)

    useMarkupStore.getState().deleteGroup([a as Markup, b as Markup])

    expect(useMarkupStore.getState().getMarkups(1).find((m) => m.id === a.id)).toBeUndefined()
    expect(useMarkupStore.getState().getMarkups(2).find((m) => m.id === b.id)).toBeUndefined()

    useMarkupStore.getState().undo()

    expect(useMarkupStore.getState().getMarkups(1).find((m) => m.id === a.id)).toBeDefined()
    expect(useMarkupStore.getState().getMarkups(2).find((m) => m.id === b.id)).toBeDefined()
  })

  it('deleteGroup with empty array is a no-op (undoStack length unchanged)', () => {
    const a = makeCount(1, 'Outlet', 1)
    useMarkupStore.getState().placeMarkup(a)
    const before = useMarkupStore.getState().undoStack.length

    useMarkupStore.getState().deleteGroup([])

    expect(useMarkupStore.getState().undoStack).toHaveLength(before)
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(1)
  })
})
