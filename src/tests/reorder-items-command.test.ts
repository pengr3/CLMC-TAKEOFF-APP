import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'

// Phase 17 (Req 2, D-11): the persisted per-category manual item order lives in
// markupStore as `categoryItemOrder: Record<catKey, string[]>` and is mutated by
// the single-store undoable command `reorderItems(catKey, newOrder)`. These tests
// exercise the command + its undo/redo branches + the defensive no-op guard,
// mirroring delete-group-command.test.ts's direct-getState() harness style.

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    categoryItemOrder: {},
    undoStack: [],
    redoStack: []
  })
})

describe('markupStore — reorderItems command (Phase 17 Req 2)', () => {
  it('reorderItems(catKey, newOrder) sets categoryItemOrder[catKey] to the new order', () => {
    useMarkupStore.getState().reorderItems('__uncat__', ['B|count', 'A|count'])

    expect(useMarkupStore.getState().categoryItemOrder['__uncat__']).toEqual([
      'B|count',
      'A|count'
    ])
  })

  it('reorderItems pushes exactly one reorder-items command onto undoStack', () => {
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)

    useMarkupStore.getState().reorderItems('cat-e', ['Wire|linear', 'Outlet|count'])

    const stack = useMarkupStore.getState().undoStack
    expect(stack).toHaveLength(1)
    expect(stack[0].type).toBe('reorder-items')
  })

  it('reorderItems clears the redoStack (a new command invalidates the redo branch)', () => {
    // Prime a redo entry: reorder, then undo (moves the command onto redoStack).
    useMarkupStore.getState().reorderItems('cat-e', ['A|count', 'B|count'])
    useMarkupStore.getState().undo()
    expect(useMarkupStore.getState().redoStack).toHaveLength(1)

    // A fresh reorder must clear the pending redo.
    useMarkupStore.getState().reorderItems('cat-e', ['B|count', 'A|count'])
    expect(useMarkupStore.getState().redoStack).toHaveLength(0)
  })

  it('undo() after reorderItems restores the prior order ([] when the category had none)', () => {
    useMarkupStore.getState().reorderItems('__uncat__', ['B|count', 'A|count'])

    useMarkupStore.getState().undo()

    // The category started with no persisted order → undo restores [].
    expect(useMarkupStore.getState().categoryItemOrder['__uncat__']).toEqual([])
    // The command moved from undoStack onto redoStack.
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
    expect(useMarkupStore.getState().redoStack).toHaveLength(1)
  })

  it('undo() restores a NON-empty prior order (not just [])', () => {
    // Seed a starting order, then reorder over it.
    useMarkupStore.setState({ categoryItemOrder: { 'cat-e': ['A|count', 'B|count', 'C|count'] } })

    useMarkupStore.getState().reorderItems('cat-e', ['C|count', 'B|count', 'A|count'])
    expect(useMarkupStore.getState().categoryItemOrder['cat-e']).toEqual([
      'C|count',
      'B|count',
      'A|count'
    ])

    useMarkupStore.getState().undo()

    // Undo must restore the exact prior order, not wipe to [].
    expect(useMarkupStore.getState().categoryItemOrder['cat-e']).toEqual([
      'A|count',
      'B|count',
      'C|count'
    ])
  })

  it('redo() after undo() re-applies the new order', () => {
    useMarkupStore.getState().reorderItems('__uncat__', ['B|count', 'A|count'])
    useMarkupStore.getState().undo()

    useMarkupStore.getState().redo()

    expect(useMarkupStore.getState().categoryItemOrder['__uncat__']).toEqual([
      'B|count',
      'A|count'
    ])
    // redo moves the command back onto undoStack, clears redoStack.
    expect(useMarkupStore.getState().undoStack).toHaveLength(1)
    expect(useMarkupStore.getState().redoStack).toHaveLength(0)
  })

  it('a no-op reorder (same array as current) does NOT push a command', () => {
    useMarkupStore.setState({ categoryItemOrder: { 'cat-e': ['A|count', 'B|count'] } })
    const before = useMarkupStore.getState().undoStack.length

    // Structurally-equal but distinct array reference — must still be detected as no-op.
    useMarkupStore.getState().reorderItems('cat-e', ['A|count', 'B|count'])

    expect(useMarkupStore.getState().undoStack).toHaveLength(before)
    expect(useMarkupStore.getState().categoryItemOrder['cat-e']).toEqual(['A|count', 'B|count'])
  })

  it('a no-op reorder of an ABSENT category ([] === []) does NOT push a command', () => {
    // Category has no entry (oldOrder defaults to []); reordering to [] is a no-op.
    useMarkupStore.getState().reorderItems('never-touched', [])

    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
  })

  it('reordering one category leaves other categories untouched', () => {
    useMarkupStore.setState({
      categoryItemOrder: { 'cat-a': ['X|count'], 'cat-b': ['Y|count', 'Z|count'] }
    })

    useMarkupStore.getState().reorderItems('cat-b', ['Z|count', 'Y|count'])

    expect(useMarkupStore.getState().categoryItemOrder['cat-a']).toEqual(['X|count'])
    expect(useMarkupStore.getState().categoryItemOrder['cat-b']).toEqual(['Z|count', 'Y|count'])
  })
})
