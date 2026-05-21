import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import type { LinearMarkup } from '@renderer/types/markup'

// Reset the store to a known-clean state before each test. Same pattern as
// src/tests/markup-store.test.ts so behaviour stays orthogonal across files.
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
      { x: 100, y: 0 },
      { x: 100, y: 100 }
    ],
    createdAt: Date.now()
  }
}

describe('markupStore — moveVertex command', () => {
  it('moveVertex moves the vertex at the given index and pushes move-vertex command', () => {
    const linear = makeLinear()
    useMarkupStore.getState().placeMarkup(linear)
    useMarkupStore
      .getState()
      .moveVertex(linear.id, linear.page, 0, { x: 50, y: 50 })

    const { pageMarkups, undoStack } = useMarkupStore.getState()
    const updated = pageMarkups[1][0] as LinearMarkup
    expect(updated.points[0]).toEqual({ x: 50, y: 50 })
    expect(undoStack[undoStack.length - 1].type).toBe('move-vertex')
  })

  it('moveVertex undo restores the original vertex position', () => {
    const linear = makeLinear()
    useMarkupStore.getState().placeMarkup(linear)
    useMarkupStore
      .getState()
      .moveVertex(linear.id, linear.page, 0, { x: 50, y: 50 })
    useMarkupStore.getState().undo()

    const { pageMarkups, redoStack } = useMarkupStore.getState()
    const restored = pageMarkups[1][0] as LinearMarkup
    expect(restored.points[0]).toEqual({ x: 0, y: 0 })
    expect(redoStack.length).toBe(1)
  })

  it('moveVertex redo re-applies the vertex move', () => {
    const linear = makeLinear()
    useMarkupStore.getState().placeMarkup(linear)
    useMarkupStore
      .getState()
      .moveVertex(linear.id, linear.page, 0, { x: 50, y: 50 })
    useMarkupStore.getState().undo()
    useMarkupStore.getState().redo()

    const { pageMarkups } = useMarkupStore.getState()
    const reapplied = pageMarkups[1][0] as LinearMarkup
    expect(reapplied.points[0]).toEqual({ x: 50, y: 50 })
  })

  it('moveVertex is a no-op for unknown markupId', () => {
    useMarkupStore
      .getState()
      .moveVertex('nonexistent', 1, 0, { x: 10, y: 10 })

    expect(useMarkupStore.getState().undoStack.length).toBe(0)
  })

  it('moveVertex clears redoStack', () => {
    const linear = makeLinear()
    useMarkupStore.getState().placeMarkup(linear)
    // Undo the place to put a command on the redoStack
    useMarkupStore.getState().undo()
    expect(useMarkupStore.getState().redoStack.length).toBe(1)

    // Re-place so we have a target for moveVertex (and to be sure the
    // following moveVertex actually mutates a markup)
    useMarkupStore.getState().placeMarkup(linear)
    // Undo the second place too — now redoStack has 1 again, and the markup
    // is gone. Re-redo to restore it.
    useMarkupStore.getState().undo()
    useMarkupStore.getState().redo()
    expect(useMarkupStore.getState().redoStack.length).toBe(0)

    // Place once more to set up the actual scenario: redoStack non-empty,
    // then call moveVertex and assert it clears redoStack.
    // Simpler path: place, undo (place command -> redoStack), redo (back),
    // then moveVertex. But that leaves redoStack=0 already.
    // Use the cleanest path: place markup, manually push something to redoStack
    // via undo+redo cycle on a SECOND place; then moveVertex must clear it.
    const second = makeLinear(1, 'Other')
    useMarkupStore.getState().placeMarkup(second)
    useMarkupStore.getState().undo()
    expect(useMarkupStore.getState().redoStack.length).toBe(1)

    useMarkupStore
      .getState()
      .moveVertex(linear.id, linear.page, 0, { x: 50, y: 50 })
    expect(useMarkupStore.getState().redoStack.length).toBe(0)
  })
})
