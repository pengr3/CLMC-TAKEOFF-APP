// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { isTextInputActive } from '@renderer/hooks/useKeyboardShortcuts'
import { useMarkupStore } from '@renderer/stores/markupStore'
import type { CountMarkup } from '@renderer/types/markup'

beforeEach(() => {
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
  // Clear any active element / DOM state
  if (typeof document !== 'undefined') {
    document.body.innerHTML = ''
  }
})

describe('isTextInputActive', () => {
  it('returns false when no active element', () => {
    expect(isTextInputActive()).toBe(false)
  })

  it('returns true when an <input> is focused', () => {
    const input = document.createElement('input')
    input.type = 'text'
    document.body.appendChild(input)
    input.focus()
    expect(isTextInputActive()).toBe(true)
  })

  it('returns true when a <textarea> is focused', () => {
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    ta.focus()
    expect(isTextInputActive()).toBe(true)
  })

  it('returns true for contenteditable element', () => {
    const div = document.createElement('div')
    div.contentEditable = 'true'
    div.tabIndex = 0 // required for focus() to work in jsdom
    document.body.appendChild(div)
    div.focus()
    expect(isTextInputActive()).toBe(true)
  })

  it('returns false for regular div focus', () => {
    const div = document.createElement('div')
    div.tabIndex = 0
    document.body.appendChild(div)
    div.focus()
    expect(isTextInputActive()).toBe(false)
  })
})

describe('markupStore undo/redo round-trip (integration gate for MARK-09/10)', () => {
  function makeCount(i: number, categoryId: string): CountMarkup {
    return {
      id: `m-${i}`,
      type: 'count',
      page: 1,
      name: 'Item',
      categoryId,
      sequence: i,
      point: { x: i, y: i },
      createdAt: i
    }
  }

  it('20 places -> 20 undos -> 20 redos preserves data', () => {
    const store = useMarkupStore.getState()
    const cat = store.getOrCreateCategory('Test')
    const originals: CountMarkup[] = []
    for (let i = 1; i <= 20; i++) {
      const m = makeCount(i, cat.id)
      originals.push(m)
      useMarkupStore.getState().placeMarkup(m)
    }
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(20)

    for (let i = 0; i < 20; i++) useMarkupStore.getState().undo()
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(0)

    for (let i = 0; i < 20; i++) useMarkupStore.getState().redo()
    const restored = useMarkupStore.getState().getMarkups(1)
    expect(restored).toHaveLength(20)
    // Exact deep-equal of each originally-placed markup
    originals.forEach((orig) => {
      expect(restored.find((m) => m.id === orig.id)).toEqual(orig)
    })
  })

  it('undo at empty stack is a no-op', () => {
    expect(() => useMarkupStore.getState().undo()).not.toThrow()
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(0)
  })

  it('redo at empty stack is a no-op', () => {
    expect(() => useMarkupStore.getState().redo()).not.toThrow()
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(0)
  })

  it('new action after undo clears redo stack', () => {
    const cat = useMarkupStore.getState().getOrCreateCategory('Test')
    const m1 = makeCount(1, cat.id)
    const m2 = makeCount(2, cat.id)
    const m3 = makeCount(3, cat.id)

    useMarkupStore.getState().placeMarkup(m1)
    useMarkupStore.getState().placeMarkup(m2)
    useMarkupStore.getState().undo()
    // Redo stack has m2; now place m3 — clears redo stack
    useMarkupStore.getState().placeMarkup(m3)
    expect(useMarkupStore.getState().canRedo()).toBe(false)
    expect(useMarkupStore.getState().getMarkups(1)).toHaveLength(2) // m1, m3
  })
})
