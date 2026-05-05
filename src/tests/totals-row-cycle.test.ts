/** @vitest-environment jsdom */
/**
 * TotalsRow cycle navigation — D-10 contract (plan 06-05).
 *
 * Asserts:
 *   1. First click → setPage to first page containing matches; pulse fires.
 *   2. Second click → advances to next page in pages-with-matches; pulse fires.
 *   3. Third click on the third page → wraps back to N1.
 *   4. Click on a row with no matches anywhere → setPage NOT called.
 *   5. mouseLeave resets cycle index (so the next mouseEnter+click starts again at N1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { TotalsRow } from '@renderer/components/TotalsRow'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import type { CountMarkup, Markup } from '@renderer/types/markup'
import type { BoqItemRow } from '@renderer/lib/boq-types'

interface MountResult {
  container: HTMLElement
  root: Root
  unmount: () => void
}

function mount(element: React.ReactElement): MountResult {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(element)
  })
  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    }
  }
}

function makeCount(page: number, name: string, color: string, sequence: number): CountMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'count',
    page,
    name,
    categoryId: 'cat-1',
    color,
    sequence,
    point: { x: 0, y: 0 },
    createdAt: Date.now()
  }
}

/**
 * React 19 delegates mouseenter/mouseleave from `mouseover` / `mouseout`
 * with relatedTarget crossing semantics. Native `mouseleave` does NOT trip
 * React's synthetic handler in jsdom — see totals-row-hover.test.ts for
 * the same helper.
 */
function fireMouseLeave(target: HTMLElement): void {
  const ev = new MouseEvent('mouseout', { bubbles: true, cancelable: true })
  Object.defineProperty(ev, 'relatedTarget', { value: document.body })
  target.dispatchEvent(ev)
}

const baseItem: BoqItemRow = {
  label: 'Outlet (count)',
  quantity: 3,
  uom: 'ea',
  color: '#0078d4',
  type: 'count'
}

beforeEach(() => {
  useViewerStore.setState({
    currentPage: 1,
    totalPages: 5,
    pageViewports: {},
    pageScales: {}
  })
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('TotalsRow click cycle (D-10)', () => {
  it('first click navigates to first page containing matches and fires pulse', () => {
    // Outlet exists on pages 2 and 4 only
    useMarkupStore.setState({
      pageMarkups: {
        2: [makeCount(2, 'Outlet', '#0078d4', 1)],
        4: [makeCount(4, 'Outlet', '#0078d4', 1)]
      },
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })

    const setPageSpy = vi.spyOn(useViewerStore.getState(), 'setPage')
    const onTriggerPulse = vi.fn()

    const { container, unmount } = mount(
      React.createElement(TotalsRow, {
        item: baseItem,
        cycleIndex: 0,
        currentPageMatches: [],
        onHover: vi.fn(),
        onClick: vi.fn(),
        onContextMenu: vi.fn(),
        onTriggerPulse
      })
    )
    try {
      const row = container.querySelector('[data-testid="totals-row"]') as HTMLElement
      act(() => {
        row.click()
      })
      expect(setPageSpy).toHaveBeenCalledTimes(1)
      expect(setPageSpy).toHaveBeenCalledWith(2)
      // Pulse fired with the matching markups on page 2 + the row's color
      expect(onTriggerPulse).toHaveBeenCalledTimes(1)
      const [matches, color] = onTriggerPulse.mock.calls[0] as [Markup[], string]
      expect(matches.length).toBe(1)
      expect(matches[0].name).toBe('Outlet')
      expect(matches[0].page).toBe(2)
      expect(color).toBe('#0078d4')
    } finally {
      unmount()
    }
  })

  it('second click advances to N2; third click wraps to N1', () => {
    // Outlet on pages 1, 3, 5
    useMarkupStore.setState({
      pageMarkups: {
        1: [makeCount(1, 'Outlet', '#0078d4', 1)],
        3: [makeCount(3, 'Outlet', '#0078d4', 1)],
        5: [makeCount(5, 'Outlet', '#0078d4', 1)]
      },
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })

    const setPageSpy = vi.spyOn(useViewerStore.getState(), 'setPage')

    const { container, unmount } = mount(
      React.createElement(TotalsRow, {
        item: baseItem,
        cycleIndex: 0,
        currentPageMatches: [makeCount(1, 'Outlet', '#0078d4', 1)],
        onHover: vi.fn(),
        onClick: vi.fn(),
        onContextMenu: vi.fn(),
        onTriggerPulse: vi.fn()
      })
    )
    try {
      const row = container.querySelector('[data-testid="totals-row"]') as HTMLElement
      act(() => {
        row.click()
      })
      act(() => {
        row.click()
      })
      act(() => {
        row.click()
      })
      act(() => {
        row.click()
      })
      // 4 clicks across 3 pages → 1, 3, 5, 1 (wrap)
      const calls = setPageSpy.mock.calls.map((c) => c[0])
      expect(calls).toEqual([1, 3, 5, 1])
    } finally {
      unmount()
    }
  })

  it('row with no matches anywhere → click does NOT call setPage', () => {
    // No 'Outlet' markups anywhere
    useMarkupStore.setState({
      pageMarkups: {
        1: [makeCount(1, 'Switch', '#d13438', 1)]
      },
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })

    const setPageSpy = vi.spyOn(useViewerStore.getState(), 'setPage')

    const { container, unmount } = mount(
      React.createElement(TotalsRow, {
        item: baseItem,
        cycleIndex: 0,
        currentPageMatches: [],
        onHover: vi.fn(),
        onClick: vi.fn(),
        onContextMenu: vi.fn(),
        onTriggerPulse: vi.fn()
      })
    )
    try {
      const row = container.querySelector('[data-testid="totals-row"]') as HTMLElement
      act(() => {
        row.click()
      })
      expect(setPageSpy).not.toHaveBeenCalled()
    } finally {
      unmount()
    }
  })

  it('mouseLeave resets cycle so the next click starts again at N1', () => {
    useMarkupStore.setState({
      pageMarkups: {
        2: [makeCount(2, 'Outlet', '#0078d4', 1)],
        4: [makeCount(4, 'Outlet', '#0078d4', 1)]
      },
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })

    const setPageSpy = vi.spyOn(useViewerStore.getState(), 'setPage')

    const { container, unmount } = mount(
      React.createElement(TotalsRow, {
        item: baseItem,
        cycleIndex: 0,
        currentPageMatches: [],
        onHover: vi.fn(),
        onClick: vi.fn(),
        onContextMenu: vi.fn(),
        onTriggerPulse: vi.fn()
      })
    )
    try {
      const row = container.querySelector('[data-testid="totals-row"]') as HTMLElement
      // First click → 2; second → 4
      act(() => {
        row.click()
      })
      act(() => {
        row.click()
      })
      // Reset via mouseLeave
      act(() => {
        fireMouseLeave(row)
      })
      // Next click should restart at N1 (page 2), not advance to wrap
      act(() => {
        row.click()
      })
      const calls = setPageSpy.mock.calls.map((c) => c[0])
      expect(calls).toEqual([2, 4, 2])
    } finally {
      unmount()
    }
  })

  it('perimeter-area row resolves underlying markup type "perimeter" for cycle navigation', () => {
    // Underlying perimeter markups on pages 2 and 3 (BoqRowType perimeter-area maps to Markup.type 'perimeter')
    const perimA: Markup = {
      id: 'p-a',
      type: 'perimeter',
      page: 2,
      name: 'Wall',
      categoryId: 'cat-1',
      color: '#107c10',
      createdAt: 1,
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 3 },
        { x: 0, y: 3 }
      ]
    }
    const perimB: Markup = {
      id: 'p-b',
      type: 'perimeter',
      page: 3,
      name: 'Wall',
      categoryId: 'cat-1',
      color: '#107c10',
      createdAt: 2,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 }
      ]
    }
    useMarkupStore.setState({
      pageMarkups: { 2: [perimA], 3: [perimB] },
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })

    const setPageSpy = vi.spyOn(useViewerStore.getState(), 'setPage')
    const item: BoqItemRow = {
      label: 'Wall (area)',
      quantity: 15,
      uom: 'm²',
      color: '#107c10',
      type: 'perimeter-area'
    }

    const { container, unmount } = mount(
      React.createElement(TotalsRow, {
        item,
        cycleIndex: 0,
        currentPageMatches: [],
        onHover: vi.fn(),
        onClick: vi.fn(),
        onContextMenu: vi.fn(),
        onTriggerPulse: vi.fn()
      })
    )
    try {
      const row = container.querySelector('[data-testid="totals-row"]') as HTMLElement
      act(() => {
        row.click()
      })
      expect(setPageSpy).toHaveBeenCalledWith(2)
    } finally {
      unmount()
    }
  })
})
