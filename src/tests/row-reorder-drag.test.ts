/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { useRowReorder, moveKey } from '@renderer/hooks/useRowReorder'
import { useMarkupStore } from '@renderer/stores/markupStore'

// Phase 17 (Req 2, D-09/D-10): the shared grip-drag lifecycle computes a drop index from the
// pointer Y vs each row's midpoint and dispatches exactly ONE reorderItems on pointerup. These
// tests drive the hook through a minimal jsdom harness (rows + grips) and inject a mock
// reorderItems onto the store to observe the dispatch. jsdom has no layout, so the harness
// injects fixed row midpoints via getRowRects (the hook's rect source), keeping the drop-index
// math deterministic.
//
// NOTE: the mock is injected via setState per test (not vi.spyOn on getState().reorderItems),
// because zustand's setState spreads the previous state object forward — a spy left on one
// test's state leaks its call history onto the next test. beforeEach restores the real command.

const CAT_KEY = 'cat-e'
const ROWS = ['A|count', 'B|count', 'C|count']
// Fixed vertical midpoints, top→bottom. getBoundingClientRect returns 0 in jsdom, so the harness
// supplies these through getRowRects instead.
const MIDS: Record<string, number> = { 'A|count': 10, 'B|count': 30, 'C|count': 50 }

/** The genuine command — restored before every test so no injected mock leaks forward. */
const REAL_REORDER = useMarkupStore.getState().reorderItems

interface HarnessHandles {
  gripAt: (index: number) => Element
  nonGrip: () => Element
  cleanup: () => void
}

function Harness(): React.ReactElement {
  const { onGripPointerDown } = useRowReorder(CAT_KEY, ROWS)
  const getRowRects = (): Array<{ key: string; mid: number }> =>
    ROWS.map((k) => ({ key: k, mid: MIDS[k] }))

  return React.createElement(
    'div',
    { 'data-testid': 'list' },
    ...ROWS.map((k, i) =>
      React.createElement(
        'div',
        { key: k, 'data-testid': `row-${i}` },
        React.createElement(
          'span',
          {
            'data-testid': `grip-${i}`,
            onPointerDown: (e: React.PointerEvent) => onGripPointerDown(e, k, getRowRects)
          },
          'grip'
        ),
        React.createElement('span', null, k)
      )
    ),
    React.createElement('div', { 'data-testid': 'non-grip' }, 'not a grip')
  )
}

function mountHarness(): HarnessHandles {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  act(() => {
    root.render(React.createElement(Harness))
  })
  return {
    gripAt: (index) => {
      const el = container.querySelector(`[data-testid="grip-${index}"]`)
      if (!el) throw new Error(`grip-${index} not found`)
      return el
    },
    nonGrip: () => {
      const el = container.querySelector('[data-testid="non-grip"]')
      if (!el) throw new Error('non-grip not found')
      return el
    },
    cleanup: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}

/** Build a PointerEvent when the environment supports it, else a MouseEvent (jsdom fallback). */
function pointerEvent(type: string, clientY: number): Event {
  try {
    return new PointerEvent(type, { bubbles: true, cancelable: true, clientX: 0, clientY })
  } catch {
    return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 0, clientY })
  }
}

function firePointerDown(node: Element, clientY: number): void {
  act(() => {
    node.dispatchEvent(pointerEvent('pointerdown', clientY))
  })
}
function firePointerMove(clientY: number): void {
  act(() => {
    window.dispatchEvent(pointerEvent('pointermove', clientY))
  })
}
function firePointerUp(clientY: number): void {
  act(() => {
    window.dispatchEvent(pointerEvent('pointerup', clientY))
  })
}

/** Inject a fresh mock reorderItems for this test and return it. */
function injectReorderSpy(): ReturnType<typeof vi.fn> {
  const spy = vi.fn()
  useMarkupStore.setState({ reorderItems: spy as unknown as typeof REAL_REORDER })
  return spy
}

describe('useRowReorder — grip-drag lifecycle (Phase 17 Req 2)', () => {
  beforeEach(() => {
    useMarkupStore.setState({
      categoryItemOrder: {},
      undoStack: [],
      redoStack: [],
      reorderItems: REAL_REORDER
    })
  })

  it('a grip drag past a sibling midpoint dispatches exactly ONE reorderItems with the new order', () => {
    const spy = injectReorderSpy()
    const h = mountHarness()
    try {
      // Grab row A (index 0, mid 10); drag to y=35 (below B's mid 30, above C's mid 50).
      firePointerDown(h.gripAt(0), 10)
      firePointerMove(35)
      firePointerUp(35)

      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(CAT_KEY, ['B|count', 'A|count', 'C|count'])
    } finally {
      h.cleanup()
    }
  })

  it('a pointerdown on a NON-grip element never starts a drag (no dispatch)', () => {
    const spy = injectReorderSpy()
    const h = mountHarness()
    try {
      // Pointerdown lands on a non-grip element → onGripPointerDown never runs → no window
      // listeners are registered → the subsequent move/up are inert.
      firePointerDown(h.nonGrip(), 10)
      firePointerMove(35)
      firePointerUp(35)

      expect(spy).not.toHaveBeenCalled()
    } finally {
      h.cleanup()
    }
  })

  it('a drag that returns to the origin index dispatches nothing (no-op guard)', () => {
    const spy = injectReorderSpy()
    const h = mountHarness()
    try {
      // Grab A (mid 10); move to y=15 — still above B's mid (30), so the drop index maps back to
      // A's original slot → newOrder === startOrder → skipped.
      firePointerDown(h.gripAt(0), 10)
      firePointerMove(15)
      firePointerUp(15)

      expect(spy).not.toHaveBeenCalled()
    } finally {
      h.cleanup()
    }
  })

  it('moveKey re-inserts a key at the drop boundary (unit)', () => {
    expect(moveKey(ROWS, 'A|count', 2)).toEqual(['B|count', 'A|count', 'C|count'])
    expect(moveKey(ROWS, 'C|count', 0)).toEqual(['C|count', 'A|count', 'B|count'])
    // dropIndex 1 for A maps back to its own slot → no-op.
    expect(moveKey(ROWS, 'A|count', 1)).toEqual(['A|count', 'B|count', 'C|count'])
  })
})
