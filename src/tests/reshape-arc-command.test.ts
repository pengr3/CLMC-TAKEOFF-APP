import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import type { AreaMarkup, ArcMap } from '@renderer/types/markup'

// Reset the store to a known-clean state before each test (same pattern as
// move-vertex-command.test.ts so behaviour stays orthogonal across files).
beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
})

function makeArea(arcs?: ArcMap): AreaMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'area',
    page: 1,
    name: 'Slab',
    categoryId: 'cat-1',
    color: '#107c10',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ],
    ...(arcs ? { arcs } : {}),
    createdAt: Date.now()
  }
}

describe('markupStore — reshapeArc command', () => {
  it('reshapeArc applies the new arcs map and pushes exactly one reshape-arc command', () => {
    const area = makeArea({ 0: { midX: 50, midY: -20 } })
    useMarkupStore.getState().placeMarkup(area)

    const newArcs: ArcMap = { 0: { midX: 50, midY: -40 } }
    useMarkupStore.getState().reshapeArc(area.id, area.page, newArcs)

    const { pageMarkups, undoStack } = useMarkupStore.getState()
    const updated = pageMarkups[1][0] as AreaMarkup
    expect(updated.arcs).toEqual({ 0: { midX: 50, midY: -40 } })
    expect(undoStack[undoStack.length - 1].type).toBe('reshape-arc')
  })

  it('reshapeArc clears the redoStack (mirrors moveVertex)', () => {
    const area = makeArea({ 0: { midX: 50, midY: -20 } })
    useMarkupStore.getState().placeMarkup(area)
    // Push a command onto redoStack via a separate place+undo.
    const second = makeArea()
    useMarkupStore.getState().placeMarkup(second)
    useMarkupStore.getState().undo()
    expect(useMarkupStore.getState().redoStack.length).toBe(1)

    useMarkupStore
      .getState()
      .reshapeArc(area.id, area.page, { 0: { midX: 50, midY: -40 } })
    expect(useMarkupStore.getState().redoStack.length).toBe(0)
  })

  it('reshapeArc undo restores the exact prior arcs map, redo re-applies newArcs (0 drift)', () => {
    const oldArcs: ArcMap = { 0: { midX: 50, midY: -20 }, 2: { midX: 50, midY: 120 } }
    const area = makeArea(oldArcs)
    useMarkupStore.getState().placeMarkup(area)

    const newArcs: ArcMap = { 0: { midX: 50, midY: -60 }, 2: { midX: 50, midY: 160 } }
    useMarkupStore.getState().reshapeArc(area.id, area.page, newArcs)

    // After reshape → newArcs
    expect((useMarkupStore.getState().pageMarkups[1][0] as AreaMarkup).arcs).toEqual(newArcs)

    // undo → oldArcs (byte-equal to the original)
    useMarkupStore.getState().undo()
    expect((useMarkupStore.getState().pageMarkups[1][0] as AreaMarkup).arcs).toEqual(oldArcs)

    // redo → newArcs
    useMarkupStore.getState().redo()
    expect((useMarkupStore.getState().pageMarkups[1][0] as AreaMarkup).arcs).toEqual(newArcs)

    // undo again → oldArcs (round-trip undo→redo→undo, 0 drift)
    useMarkupStore.getState().undo()
    expect((useMarkupStore.getState().pageMarkups[1][0] as AreaMarkup).arcs).toEqual(oldArcs)
  })

  it('reshapeArc undo removes an arc the edit ADDED (oldArcs undefined → field absent)', () => {
    // Markup starts with NO arcs (all-straight). The edit adds the first arc.
    const area = makeArea()
    useMarkupStore.getState().placeMarkup(area)
    expect((useMarkupStore.getState().pageMarkups[1][0] as AreaMarkup).arcs).toBeUndefined()

    useMarkupStore.getState().reshapeArc(area.id, area.page, { 1: { midX: 100, midY: 50 } })
    expect((useMarkupStore.getState().pageMarkups[1][0] as AreaMarkup).arcs).toEqual({
      1: { midX: 100, midY: 50 }
    })

    // undo must restore the all-straight state — the arcs field is gone again.
    useMarkupStore.getState().undo()
    expect((useMarkupStore.getState().pageMarkups[1][0] as AreaMarkup).arcs).toBeUndefined()
  })

  it('reshapeArc with newArcs undefined clears all arcs (revert to straight)', () => {
    const area = makeArea({ 0: { midX: 50, midY: -20 } })
    useMarkupStore.getState().placeMarkup(area)

    useMarkupStore.getState().reshapeArc(area.id, area.page, undefined)
    expect((useMarkupStore.getState().pageMarkups[1][0] as AreaMarkup).arcs).toBeUndefined()

    // undo restores the original arc.
    useMarkupStore.getState().undo()
    expect((useMarkupStore.getState().pageMarkups[1][0] as AreaMarkup).arcs).toEqual({
      0: { midX: 50, midY: -20 }
    })
  })

  it('reshapeArc is a no-op for unknown markupId', () => {
    useMarkupStore.getState().reshapeArc('nonexistent', 1, { 0: { midX: 1, midY: 1 } })
    expect(useMarkupStore.getState().undoStack.length).toBe(0)
  })
})

describe('markupStore — moveVertex atomic arc re-solve (D-08, W-3)', () => {
  it('moveVertex with newArcs swaps points AND arcs in one command; ONE undo reverts both', () => {
    const oldArcs: ArcMap = { 0: { midX: 50, midY: -20 } }
    const area = makeArea(oldArcs)
    useMarkupStore.getState().placeMarkup(area)

    // Drag vertex 1 (the END of arc edge 0) and re-solve the arc through the new corner.
    const newPoint = { x: 140, y: 20 }
    const newArcs: ArcMap = { 0: { midX: 70, midY: -30 } }
    useMarkupStore.getState().moveVertex(area.id, area.page, 1, newPoint, newArcs)

    const after = useMarkupStore.getState().pageMarkups[1][0] as AreaMarkup
    expect(after.points[1]).toEqual(newPoint)
    expect(after.arcs).toEqual(newArcs)
    // Exactly one undo entry for the whole reshape.
    expect(useMarkupStore.getState().undoStack[useMarkupStore.getState().undoStack.length - 1].type).toBe(
      'move-vertex'
    )

    // ONE Ctrl+Z restores BOTH the vertex position and the arc curvature (W-3:
    // no half-reverted state).
    useMarkupStore.getState().undo()
    const reverted = useMarkupStore.getState().pageMarkups[1][0] as AreaMarkup
    expect(reverted.points[1]).toEqual({ x: 100, y: 0 })
    expect(reverted.arcs).toEqual(oldArcs)

    // Redo re-applies both.
    useMarkupStore.getState().redo()
    const redone = useMarkupStore.getState().pageMarkups[1][0] as AreaMarkup
    expect(redone.points[1]).toEqual(newPoint)
    expect(redone.arcs).toEqual(newArcs)
  })

  it('moveVertex without newArcs leaves the arcs field untouched (straight-edge drag)', () => {
    const oldArcs: ArcMap = { 0: { midX: 50, midY: -20 } }
    const area = makeArea(oldArcs)
    useMarkupStore.getState().placeMarkup(area)

    useMarkupStore.getState().moveVertex(area.id, area.page, 2, { x: 120, y: 120 })
    const after = useMarkupStore.getState().pageMarkups[1][0] as AreaMarkup
    expect(after.points[2]).toEqual({ x: 120, y: 120 })
    // Arc map unchanged — a non-arc-carrying move-vertex never touches arcs.
    expect(after.arcs).toEqual(oldArcs)
  })
})
