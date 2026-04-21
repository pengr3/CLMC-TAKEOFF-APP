import { describe, it, expect, beforeEach } from 'vitest'
import { useMarkupStore } from '@renderer/stores/markupStore'
import type { CountMarkup } from '@renderer/types/markup'
import { MARKUP_PALETTE } from '@renderer/lib/markup-palette'

function makeCount(
  page: number,
  name: string,
  sequence: number,
  color: string,
  categoryId = 'cat-1'
): CountMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'count',
    page,
    name,
    categoryId,
    color,
    sequence,
    point: { x: sequence * 10, y: sequence * 10 },
    createdAt: Date.now() + sequence
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

describe('recolorGroup — basic semantics', () => {
  it('no-op when no markup matches the name (no command pushed)', () => {
    useMarkupStore.getState().recolorGroup('Nonexistent', MARKUP_PALETTE[1])
    expect(useMarkupStore.getState().undoStack).toHaveLength(0)
  })

  it('changes color for every markup with matching name', () => {
    const m1 = makeCount(1, 'Switch', 1, MARKUP_PALETTE[0])
    const m2 = makeCount(1, 'Switch', 2, MARKUP_PALETTE[0])
    const m3 = makeCount(1, 'Outlet', 1, MARKUP_PALETTE[2]) // different name — must NOT change
    useMarkupStore.getState().placeMarkup(m1)
    useMarkupStore.getState().placeMarkup(m2)
    useMarkupStore.getState().placeMarkup(m3)

    useMarkupStore.getState().recolorGroup('Switch', MARKUP_PALETTE[6])

    const markups = useMarkupStore.getState().getMarkups(1)
    expect(markups.find((m) => m.id === m1.id)?.color).toBe(MARKUP_PALETTE[6])
    expect(markups.find((m) => m.id === m2.id)?.color).toBe(MARKUP_PALETTE[6])
    expect(markups.find((m) => m.id === m3.id)?.color).toBe(MARKUP_PALETTE[2]) // untouched
  })

  it('pushes exactly one command regardless of how many markups affected', () => {
    const m1 = makeCount(1, 'Switch', 1, MARKUP_PALETTE[0])
    const m2 = makeCount(1, 'Switch', 2, MARKUP_PALETTE[0])
    const m3 = makeCount(2, 'Switch', 1, MARKUP_PALETTE[0]) // page 2
    useMarkupStore.getState().placeMarkup(m1)
    useMarkupStore.getState().placeMarkup(m2)
    useMarkupStore.getState().placeMarkup(m3)

    const stackBefore = useMarkupStore.getState().undoStack.length
    useMarkupStore.getState().recolorGroup('Switch', MARKUP_PALETTE[3])
    expect(useMarkupStore.getState().undoStack.length).toBe(stackBefore + 1)
  })

  it('preserves per-markup drift when undoing (old colors restored individually)', () => {
    const m1 = makeCount(1, 'Switch', 1, MARKUP_PALETTE[0]) // red
    const m2 = makeCount(1, 'Switch', 2, MARKUP_PALETTE[1]) // orange — drifted
    useMarkupStore.getState().placeMarkup(m1)
    useMarkupStore.getState().placeMarkup(m2)

    useMarkupStore.getState().recolorGroup('Switch', MARKUP_PALETTE[6]) // blue
    useMarkupStore.getState().undo()

    const markups = useMarkupStore.getState().getMarkups(1)
    expect(markups.find((m) => m.id === m1.id)?.color).toBe(MARKUP_PALETTE[0]) // red restored
    expect(markups.find((m) => m.id === m2.id)?.color).toBe(MARKUP_PALETTE[1]) // orange restored — NOT unified
  })

  it('redo after undo re-applies the new color uniformly', () => {
    const m1 = makeCount(1, 'Switch', 1, MARKUP_PALETTE[0])
    const m2 = makeCount(1, 'Switch', 2, MARKUP_PALETTE[1])
    useMarkupStore.getState().placeMarkup(m1)
    useMarkupStore.getState().placeMarkup(m2)

    useMarkupStore.getState().recolorGroup('Switch', MARKUP_PALETTE[6])
    useMarkupStore.getState().undo()
    useMarkupStore.getState().redo()

    const markups = useMarkupStore.getState().getMarkups(1)
    expect(markups.find((m) => m.id === m1.id)?.color).toBe(MARKUP_PALETTE[6])
    expect(markups.find((m) => m.id === m2.id)?.color).toBe(MARKUP_PALETTE[6])
  })

  it('page-scoped recolor only touches matching page', () => {
    const m1 = makeCount(1, 'Switch', 1, MARKUP_PALETTE[0])
    const m2 = makeCount(2, 'Switch', 1, MARKUP_PALETTE[0])
    useMarkupStore.getState().placeMarkup(m1)
    useMarkupStore.getState().placeMarkup(m2)

    useMarkupStore.getState().recolorGroup('Switch', MARKUP_PALETTE[5], 1) // page 1 only

    expect(useMarkupStore.getState().getMarkups(1)[0].color).toBe(MARKUP_PALETTE[5])
    expect(useMarkupStore.getState().getMarkups(2)[0].color).toBe(MARKUP_PALETTE[0])
  })
})

describe('getColorForName', () => {
  it('returns null when no markup has the name', () => {
    expect(useMarkupStore.getState().getColorForName('Nonexistent')).toBeNull()
  })

  it('returns color of most-recent markup when multiple exist', () => {
    const m1 = makeCount(1, 'Switch', 1, MARKUP_PALETTE[0])
    useMarkupStore.getState().placeMarkup(m1)
    // Create a newer markup with different color
    const m2 = makeCount(1, 'Switch', 2, MARKUP_PALETTE[3])
    m2.createdAt = m1.createdAt + 1000 // ensure newer
    useMarkupStore.getState().placeMarkup(m2)

    expect(useMarkupStore.getState().getColorForName('Switch')).toBe(MARKUP_PALETTE[3])
  })

  it('page filter returns only the given page', () => {
    const m1 = makeCount(1, 'Switch', 1, MARKUP_PALETTE[0])
    const m2 = makeCount(2, 'Switch', 1, MARKUP_PALETTE[5])
    m2.createdAt = m1.createdAt + 1000
    useMarkupStore.getState().placeMarkup(m1)
    useMarkupStore.getState().placeMarkup(m2)

    expect(useMarkupStore.getState().getColorForName('Switch', 1)).toBe(MARKUP_PALETTE[0])
    expect(useMarkupStore.getState().getColorForName('Switch', 2)).toBe(MARKUP_PALETTE[5])
  })
})

describe('20+ recolor round-trip integrity (MARK-09 preservation)', () => {
  it('21 recolors + 21 undos fully restores original colors', () => {
    const m = makeCount(1, 'Switch', 1, MARKUP_PALETTE[0])
    useMarkupStore.getState().placeMarkup(m)

    for (let i = 0; i < 21; i++) {
      // Alternate across palette — each call must actually change the color to push a command
      useMarkupStore.getState().recolorGroup('Switch', MARKUP_PALETTE[(i + 1) % MARKUP_PALETTE.length])
    }
    // Undo all 21 recolors (plus place — we only undo the recolors here)
    for (let i = 0; i < 21; i++) {
      useMarkupStore.getState().undo()
    }

    expect(useMarkupStore.getState().getMarkups(1)[0].color).toBe(MARKUP_PALETTE[0])
  })
})
