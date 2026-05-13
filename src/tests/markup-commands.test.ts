import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import type { CountMarkup } from '@renderer/types/markup'
import { UNDO_STACK_MAX } from '@renderer/types/markup'

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
})

function makeCount(page: number, name: string, seq: number, categoryId: string): CountMarkup {
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

describe('place/undo symmetry', () => {
  it('place markup M → getMarkups has M', () => {
    const m = makeCount(1, 'Test', 1, 'cat-1')
    useMarkupStore.getState().placeMarkup(m)
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(1)
  })

  it('undo() → getMarkups empty; redoStack has one entry', () => {
    const m = makeCount(1, 'Test', 1, 'cat-1')
    useMarkupStore.getState().placeMarkup(m)
    useMarkupStore.getState().undo()
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(0)
    expect(useMarkupStore.getState().redoStack).toHaveLength(1)
  })

  it('redo() → getMarkups has M again; undoStack has one entry', () => {
    const m = makeCount(1, 'Test', 1, 'cat-1')
    useMarkupStore.getState().placeMarkup(m)
    useMarkupStore.getState().undo()
    useMarkupStore.getState().redo()
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(1)
    expect(useMarkupStore.getState().undoStack).toHaveLength(1)
  })
})

describe('delete/undo symmetry', () => {
  it('place M then delete M produces undoStack length 2', () => {
    const m = makeCount(1, 'Test', 1, 'cat-1')
    useMarkupStore.getState().placeMarkup(m)
    useMarkupStore.getState().deleteMarkup(1, m.id)
    expect(useMarkupStore.getState().undoStack).toHaveLength(2)
  })

  it('undo after delete restores M', () => {
    const m = makeCount(1, 'Test', 1, 'cat-1')
    useMarkupStore.getState().placeMarkup(m)
    useMarkupStore.getState().deleteMarkup(1, m.id)
    useMarkupStore.getState().undo()
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(1)
    expect(useMarkupStore.getState().getMarkups(1)[0].id).toBe(m.id)
  })

  it('undo twice (reverse delete then reverse place) → store empty', () => {
    const m = makeCount(1, 'Test', 1, 'cat-1')
    useMarkupStore.getState().placeMarkup(m)
    useMarkupStore.getState().deleteMarkup(1, m.id)
    useMarkupStore.getState().undo() // reverses delete
    useMarkupStore.getState().undo() // reverses place
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(0)
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
  })
})

describe('new action clears redo', () => {
  it('place M1, undo M1, place M2 → redoStack MUST be empty', () => {
    const m1 = makeCount(1, 'M1', 1, 'cat-1')
    const m2 = makeCount(1, 'M2', 2, 'cat-1')
    useMarkupStore.getState().placeMarkup(m1)
    useMarkupStore.getState().undo()
    expect(useMarkupStore.getState().redoStack).toHaveLength(1)
    useMarkupStore.getState().placeMarkup(m2)
    expect(useMarkupStore.getState().redoStack).toHaveLength(0)
  })

  it('redo() after new place is a no-op', () => {
    const m1 = makeCount(1, 'M1', 1, 'cat-1')
    const m2 = makeCount(1, 'M2', 2, 'cat-1')
    useMarkupStore.getState().placeMarkup(m1)
    useMarkupStore.getState().undo()
    useMarkupStore.getState().placeMarkup(m2)
    useMarkupStore.getState().redo()
    // Should still only have M2 (redo was no-op since redoStack was empty)
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(1)
    expect(useMarkupStore.getState().getMarkups(1)[0].id).toBe(m2.id)
  })
})

describe('20+ round-trip integrity (MARK-09)', () => {
  it('place 21 markups, undo 21 times → empty; undoStack empty; redoStack length 21', () => {
    const markups: CountMarkup[] = []
    for (let i = 0; i < 21; i++) {
      const m = makeCount(1, `Item ${i}`, i + 1, 'cat-1')
      markups.push(m)
      useMarkupStore.getState().placeMarkup(m)
    }
    expect(useMarkupStore.getState().undoStack).toHaveLength(21)

    for (let i = 0; i < 21; i++) {
      useMarkupStore.getState().undo()
    }

    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(0)
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
    expect(useMarkupStore.getState().redoStack).toHaveLength(21)
  })

  it('redo 21 times → getMarkups length === 21; order matches original', () => {
    const markups: CountMarkup[] = []
    for (let i = 0; i < 21; i++) {
      const m = makeCount(1, `Item ${i}`, i + 1, 'cat-1')
      markups.push(m)
      useMarkupStore.getState().placeMarkup(m)
    }
    for (let i = 0; i < 21; i++) {
      useMarkupStore.getState().undo()
    }
    for (let i = 0; i < 21; i++) {
      useMarkupStore.getState().redo()
    }

    const result = useMarkupStore.getState().getMarkups(1)
    expect(result).toHaveLength(21)
    // Each markup's id, point, sequence, name, categoryId should be preserved
    for (let i = 0; i < 21; i++) {
      const found = result.find((m) => m.id === markups[i].id)
      expect(found).toBeDefined()
      expect(found).toEqual(markups[i])
    }
  })
})

describe('stack depth clamp at UNDO_STACK_MAX', () => {
  it(`placing ${UNDO_STACK_MAX + 1} markups clamps undoStack to ${UNDO_STACK_MAX}`, () => {
    const markups: CountMarkup[] = []
    for (let i = 0; i < UNDO_STACK_MAX + 1; i++) {
      const m = makeCount(1, `Item ${i}`, i + 1, 'cat-1')
      markups.push(m)
      useMarkupStore.getState().placeMarkup(m)
    }
    expect(useMarkupStore.getState().undoStack.length).toBe(UNDO_STACK_MAX)
  })

  it('oldest command (M0) is dropped; undoing 50 times restores only M50..M1, not M0', () => {
    const markups: CountMarkup[] = []
    for (let i = 0; i < UNDO_STACK_MAX + 1; i++) {
      const m = makeCount(1, `Item ${i}`, i + 1, 'cat-1')
      markups.push(m)
      useMarkupStore.getState().placeMarkup(m)
    }

    // M0 is the first placed (i=0); M50 is last (i=50)
    // After clamp, M0 is dropped — pageMarkups still contains M0 (accepted)
    // Undo stack has M1..M50 (50 entries)
    for (let i = 0; i < UNDO_STACK_MAX; i++) {
      useMarkupStore.getState().undo()
    }

    const remaining = useMarkupStore.getState().getMarkups(1)
    // Only M0 should remain (it was accepted but fell off the undo stack)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(markups[0].id)
  })

  it('M0 remains in pageMarkups after clamped undo (not undoable but still placed)', () => {
    const markups: CountMarkup[] = []
    for (let i = 0; i < UNDO_STACK_MAX + 1; i++) {
      const m = makeCount(1, `Item ${i}`, i + 1, 'cat-1')
      markups.push(m)
      useMarkupStore.getState().placeMarkup(m)
    }

    // All 51 markups are in pageMarkups
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(UNDO_STACK_MAX + 1)
  })
})

describe('canUndo / canRedo flags', () => {
  it('empty store: canUndo() === false, canRedo() === false', () => {
    expect(useMarkupStore.getState().canUndo()).toBe(false)
    expect(useMarkupStore.getState().canRedo()).toBe(false)
  })

  it('after place: canUndo() === true', () => {
    useMarkupStore.getState().placeMarkup(makeCount(1, 'X', 1, 'cat-1'))
    expect(useMarkupStore.getState().canUndo()).toBe(true)
  })

  it('after undo: canRedo() === true', () => {
    useMarkupStore.getState().placeMarkup(makeCount(1, 'X', 1, 'cat-1'))
    useMarkupStore.getState().undo()
    expect(useMarkupStore.getState().canRedo()).toBe(true)
  })

  it('after redo: canUndo() === true, canRedo() === false (stack drained)', () => {
    useMarkupStore.getState().placeMarkup(makeCount(1, 'X', 1, 'cat-1'))
    useMarkupStore.getState().undo()
    useMarkupStore.getState().redo()
    expect(useMarkupStore.getState().canUndo()).toBe(true)
    expect(useMarkupStore.getState().canRedo()).toBe(false)
  })
})

describe('edge cases (no-op on empty stacks)', () => {
  it('undo() on empty undoStack does not throw', () => {
    expect(() => useMarkupStore.getState().undo()).not.toThrow()
  })

  it('redo() on empty redoStack does not throw', () => {
    expect(() => useMarkupStore.getState().redo()).not.toThrow()
  })

  it("deleteMarkup with 'nonexistent-id' does not push a command", () => {
    expect(() =>
      useMarkupStore.getState().deleteMarkup(1, 'nonexistent-id')
    ).not.toThrow()
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
  })
})

describe('category persistence across undo (Pitfall 4)', () => {
  it('category survives after place → delete → undo cycle', () => {
    const cat = useMarkupStore.getState().getOrCreateCategory('Electrical')
    const m = makeCount(1, 'Test', 1, cat.id)
    useMarkupStore.getState().placeMarkup(m)
    useMarkupStore.getState().deleteMarkup(1, m.id)
    useMarkupStore.getState().undo() // restores M
    const restored = useMarkupStore.getState().getMarkups(1)[0]
    expect(restored.categoryId).toBe(cat.id)
    expect(useMarkupStore.getState().getCategory(cat.id)).toBeDefined()
    expect(useMarkupStore.getState().getCategory(cat.id)?.name).toBe('Electrical')
  })

  it('categories map is NOT cleared after all undos', () => {
    const cat = useMarkupStore.getState().getOrCreateCategory('Plumbing')
    const m = makeCount(1, 'Pipe', 1, cat.id)
    useMarkupStore.getState().placeMarkup(m)
    useMarkupStore.getState().undo()
    // markups are gone, but category persists
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(0)
    expect(useMarkupStore.getState().getCategory(cat.id)).not.toBeNull()
  })
})

// RED stubs — Wave 0: editMarkup action does not exist yet; all tests below must FAIL
describe('editMarkup/undo symmetry', () => {
  it('editMarkup changes name/categoryId/color and pushes cmd to undoStack', () => {
    const cat = useMarkupStore.getState().getOrCreateCategory('Electrical')
    const m = makeCount(1, 'OldName', 1, cat.id)
    useMarkupStore.getState().placeMarkup(m)
    const newCat = useMarkupStore.getState().getOrCreateCategory('Plumbing')
    useMarkupStore.getState().editMarkup(m.id, 1, 'OldName', 'Electrical', '#dc2626', 'NewName', 'Plumbing', '#2563eb')
    const markups = useMarkupStore.getState().getMarkups(1)
    expect(markups[0].name).toBe('NewName')
    expect(markups[0].color).toBe('#2563eb')
    expect(markups[0].categoryId).toBe(newCat.id)
    expect(useMarkupStore.getState().undoStack).toHaveLength(2)
  })

  it('undo() reverts to oldName/oldCategory/oldColor; redoStack has one entry', () => {
    const cat = useMarkupStore.getState().getOrCreateCategory('Electrical')
    const m = makeCount(1, 'OldName', 1, cat.id)
    useMarkupStore.getState().placeMarkup(m)
    useMarkupStore.getState().editMarkup(m.id, 1, 'OldName', 'Electrical', '#dc2626', 'NewName', 'Plumbing', '#2563eb')
    useMarkupStore.getState().undo()
    const markups = useMarkupStore.getState().getMarkups(1)
    expect(markups[0].name).toBe('OldName')
    expect(markups[0].color).toBe('#dc2626')
    expect(markups[0].categoryId).toBe(cat.id)
    expect(useMarkupStore.getState().redoStack).toHaveLength(1)
  })

  it('redo() re-applies newName/newCategory/newColor', () => {
    const cat = useMarkupStore.getState().getOrCreateCategory('Electrical')
    const m = makeCount(1, 'OldName', 1, cat.id)
    useMarkupStore.getState().placeMarkup(m)
    useMarkupStore.getState().editMarkup(m.id, 1, 'OldName', 'Electrical', '#dc2626', 'NewName', 'Plumbing', '#2563eb')
    useMarkupStore.getState().undo()
    useMarkupStore.getState().redo()
    const markups = useMarkupStore.getState().getMarkups(1)
    expect(markups[0].name).toBe('NewName')
    expect(markups[0].color).toBe('#2563eb')
    expect(useMarkupStore.getState().undoStack).toHaveLength(2)
  })

  it('editMarkup clears redoStack', () => {
    const cat = useMarkupStore.getState().getOrCreateCategory('Electrical')
    const m = makeCount(1, 'OldName', 1, cat.id)
    useMarkupStore.getState().placeMarkup(m)
    useMarkupStore.getState().undo()
    useMarkupStore.getState().redo()
    // Pre-seed redoStack by undoing the redo
    useMarkupStore.getState().undo()
    expect(useMarkupStore.getState().redoStack).toHaveLength(1)
    // editMarkup must clear redoStack
    useMarkupStore.getState().redo()
    useMarkupStore.getState().editMarkup(m.id, 1, 'OldName', 'Electrical', '#dc2626', 'NewName', 'Plumbing', '#2563eb')
    expect(useMarkupStore.getState().redoStack).toHaveLength(0)
  })

  it('editMarkup on nonexistent markupId is a no-op', () => {
    useMarkupStore.getState().editMarkup('nonexistent-id', 1, 'OldName', 'Electrical', '#dc2626', 'NewName', 'Plumbing', '#2563eb')
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
  })
})

// RED stubs — Wave 0: D-13 canonical category substitution in store
describe('editMarkup canonical category (D-13 store side)', () => {
  it('edit to existing category name reuses the category (no duplicate created)', () => {
    useMarkupStore.getState().getOrCreateCategory('Electrical')
    const initialCategoryCount = Object.keys(useMarkupStore.getState().categories).length
    const cat = useMarkupStore.getState().getOrCreateCategory('Electrical')
    const m = makeCount(1, 'Test', 1, cat.id)
    useMarkupStore.getState().placeMarkup(m)
    // Use lowercase 'electrical' — D-13 canonical substitution should reuse 'Electrical'
    useMarkupStore.getState().editMarkup(m.id, 1, 'Test', 'Electrical', '#dc2626', 'Test', 'electrical', '#dc2626')
    expect(Object.keys(useMarkupStore.getState().categories).length).toBe(initialCategoryCount)
  })

  it('edit to new category name creates the category', () => {
    const cat = useMarkupStore.getState().getOrCreateCategory('Electrical')
    const m = makeCount(1, 'Test', 1, cat.id)
    useMarkupStore.getState().placeMarkup(m)
    const initialCategoryCount = Object.keys(useMarkupStore.getState().categories).length
    useMarkupStore.getState().editMarkup(m.id, 1, 'Test', 'Electrical', '#dc2626', 'Test', 'BrandNewCategory', '#dc2626')
    expect(Object.keys(useMarkupStore.getState().categories).length).toBe(initialCategoryCount + 1)
  })
})
