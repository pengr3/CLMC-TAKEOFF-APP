import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import type { CountMarkup, LinearMarkup } from '@renderer/types/markup'

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
})

function makeLinear(page = 1, name = 'Pipe', categoryId = 'cat-1'): LinearMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'linear',
    page,
    name,
    categoryId,
    color: '#dc2626',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ],
    createdAt: Date.now()
  }
}

function makeCount(page = 1, name = 'Light', sequence = 1, categoryId = 'cat-1'): CountMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'count',
    page,
    name,
    categoryId,
    color: '#dc2626',
    sequence,
    point: { x: 50, y: 50 },
    createdAt: Date.now()
  }
}

describe('markupStore — moveMarkups command', () => {
  it('moveMarkups translates a single linear markup', () => {
    const linear = makeLinear()
    useMarkupStore.getState().placeMarkup(linear)
    useMarkupStore.getState().moveMarkups([
      {
        markupId: linear.id,
        page: 1,
        oldPoints: linear.points,
        newPoints: [
          { x: 10, y: 10 },
          { x: 110, y: 10 }
        ]
      }
    ])

    const { pageMarkups, undoStack } = useMarkupStore.getState()
    const updated = pageMarkups[1][0] as LinearMarkup
    expect(updated.points).toEqual([
      { x: 10, y: 10 },
      { x: 110, y: 10 }
    ])
    expect(undoStack[undoStack.length - 1].type).toBe('move-markups')
  })

  it('moveMarkups translates a count pin (point, not points)', () => {
    const count = makeCount()
    useMarkupStore.getState().placeMarkup(count)
    useMarkupStore.getState().moveMarkups([
      {
        markupId: count.id,
        page: 1,
        oldPoints: [count.point],
        newPoints: [{ x: 75, y: 75 }]
      }
    ])

    const { pageMarkups } = useMarkupStore.getState()
    const updated = pageMarkups[1][0] as CountMarkup
    expect(updated.point).toEqual({ x: 75, y: 75 })
  })

  it('moveMarkups batch (group move) translates multiple markups as one command', () => {
    const a = makeLinear(1, 'A')
    const b = makeLinear(1, 'B')
    useMarkupStore.getState().placeMarkup(a)
    useMarkupStore.getState().placeMarkup(b)
    useMarkupStore.getState().moveMarkups([
      {
        markupId: a.id,
        page: 1,
        oldPoints: a.points,
        newPoints: a.points.map((p) => ({ x: p.x + 5, y: p.y + 5 }))
      },
      {
        markupId: b.id,
        page: 1,
        oldPoints: b.points,
        newPoints: b.points.map((p) => ({ x: p.x + 5, y: p.y + 5 }))
      }
    ])

    const { pageMarkups, undoStack } = useMarkupStore.getState()
    const updatedA = pageMarkups[1].find((m) => m.id === a.id) as LinearMarkup
    const updatedB = pageMarkups[1].find((m) => m.id === b.id) as LinearMarkup
    expect(updatedA.points).toEqual([
      { x: 5, y: 5 },
      { x: 105, y: 5 }
    ])
    expect(updatedB.points).toEqual([
      { x: 5, y: 5 },
      { x: 105, y: 5 }
    ])
    // 2 place commands + 1 move-markups command = 3
    expect(undoStack.length).toBe(3)
  })

  it('moveMarkups undo restores all markups in the batch', () => {
    const a = makeLinear(1, 'A')
    const b = makeLinear(1, 'B')
    useMarkupStore.getState().placeMarkup(a)
    useMarkupStore.getState().placeMarkup(b)
    useMarkupStore.getState().moveMarkups([
      {
        markupId: a.id,
        page: 1,
        oldPoints: a.points,
        newPoints: a.points.map((p) => ({ x: p.x + 5, y: p.y + 5 }))
      },
      {
        markupId: b.id,
        page: 1,
        oldPoints: b.points,
        newPoints: b.points.map((p) => ({ x: p.x + 5, y: p.y + 5 }))
      }
    ])
    useMarkupStore.getState().undo()

    const { pageMarkups, redoStack } = useMarkupStore.getState()
    const restoredA = pageMarkups[1].find((m) => m.id === a.id) as LinearMarkup
    const restoredB = pageMarkups[1].find((m) => m.id === b.id) as LinearMarkup
    expect(restoredA.points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ])
    expect(restoredB.points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ])
    expect(redoStack.length).toBe(1)
  })

  it('moveMarkups redo re-applies the batch move', () => {
    const a = makeLinear(1, 'A')
    const b = makeLinear(1, 'B')
    useMarkupStore.getState().placeMarkup(a)
    useMarkupStore.getState().placeMarkup(b)
    useMarkupStore.getState().moveMarkups([
      {
        markupId: a.id,
        page: 1,
        oldPoints: a.points,
        newPoints: a.points.map((p) => ({ x: p.x + 5, y: p.y + 5 }))
      },
      {
        markupId: b.id,
        page: 1,
        oldPoints: b.points,
        newPoints: b.points.map((p) => ({ x: p.x + 5, y: p.y + 5 }))
      }
    ])
    useMarkupStore.getState().undo()
    useMarkupStore.getState().redo()

    const { pageMarkups } = useMarkupStore.getState()
    const reAppliedA = pageMarkups[1].find((m) => m.id === a.id) as LinearMarkup
    const reAppliedB = pageMarkups[1].find((m) => m.id === b.id) as LinearMarkup
    expect(reAppliedA.points).toEqual([
      { x: 5, y: 5 },
      { x: 105, y: 5 }
    ])
    expect(reAppliedB.points).toEqual([
      { x: 5, y: 5 },
      { x: 105, y: 5 }
    ])
  })

  it('moveMarkups is a no-op for empty moves array', () => {
    useMarkupStore.getState().moveMarkups([])
    expect(useMarkupStore.getState().undoStack.length).toBe(0)
  })
})
