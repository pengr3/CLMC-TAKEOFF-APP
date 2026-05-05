/** @vitest-environment jsdom */
/**
 * TotalsRow hover — D-11 contract (plan 06-05).
 *
 * Asserts:
 *   1. mouseEnter calls onHover with the prop-passed currentPageMatches
 *      (caller pre-resolves matches to avoid re-deriving inside the row).
 *   2. mouseLeave calls onHover([]).
 *   3. Hover does NOT call setPage (no navigation on hover — only on click).
 *   4. The matches handed to onHover are exactly the ones passed in (zero filtering inside row).
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

const baseItem: BoqItemRow = {
  label: 'Outlet (count)',
  quantity: 2,
  uom: 'ea',
  color: '#0078d4',
  type: 'count'
}

beforeEach(() => {
  useViewerStore.setState({
    currentPage: 1,
    totalPages: 3,
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

/**
 * React 19's synthetic event system delegates from the root via `mouseover`
 * and `mouseout` events (with relatedTarget crossing semantics) to fire
 * `onMouseEnter` / `onMouseLeave`. Dispatching native `mouseenter` / `mouseleave`
 * directly does NOT trip React's synthetic handlers in jsdom. We use a helper
 * that dispatches `mouseover` (relatedTarget = outside element) for enter,
 * and `mouseout` (relatedTarget = outside element) for leave.
 */
function fireMouseEnter(target: HTMLElement): void {
  const ev = new MouseEvent('mouseover', { bubbles: true, cancelable: true })
  // relatedTarget is read-only — assign via Object.defineProperty
  Object.defineProperty(ev, 'relatedTarget', { value: document.body })
  target.dispatchEvent(ev)
}

function fireMouseLeave(target: HTMLElement): void {
  const ev = new MouseEvent('mouseout', { bubbles: true, cancelable: true })
  Object.defineProperty(ev, 'relatedTarget', { value: document.body })
  target.dispatchEvent(ev)
}

describe('TotalsRow hover (D-11)', () => {
  it('mouseEnter calls onHover with the current-page matches passed in via props', () => {
    const onHover = vi.fn()
    const currentMatches: Markup[] = [makeCount(1, 'Outlet', '#0078d4', 1)]

    const { container, unmount } = mount(
      React.createElement(TotalsRow, {
        item: baseItem,
        cycleIndex: 0,
        currentPageMatches: currentMatches,
        onHover,
        onClick: vi.fn(),
        onContextMenu: vi.fn(),
        onTriggerPulse: vi.fn()
      })
    )
    try {
      const row = container.querySelector('[data-testid="totals-row"]') as HTMLElement
      act(() => {
        fireMouseEnter(row)
      })
      expect(onHover).toHaveBeenCalledTimes(1)
      // Same array reference passed through (no internal filtering)
      expect(onHover).toHaveBeenCalledWith(currentMatches)
      expect(onHover.mock.calls[0][0]).toBe(currentMatches)
    } finally {
      unmount()
    }
  })

  it('mouseLeave calls onHover with empty array', () => {
    const onHover = vi.fn()
    const currentMatches: Markup[] = [makeCount(1, 'Outlet', '#0078d4', 1)]

    const { container, unmount } = mount(
      React.createElement(TotalsRow, {
        item: baseItem,
        cycleIndex: 0,
        currentPageMatches: currentMatches,
        onHover,
        onClick: vi.fn(),
        onContextMenu: vi.fn(),
        onTriggerPulse: vi.fn()
      })
    )
    try {
      const row = container.querySelector('[data-testid="totals-row"]') as HTMLElement
      act(() => {
        fireMouseEnter(row)
      })
      act(() => {
        fireMouseLeave(row)
      })
      // Last call had empty array
      const lastCall = onHover.mock.calls[onHover.mock.calls.length - 1][0]
      expect(Array.isArray(lastCall)).toBe(true)
      expect(lastCall.length).toBe(0)
    } finally {
      unmount()
    }
  })

  it('hover does NOT navigate to a different page (no setPage call on enter or leave)', () => {
    // Set up Outlet on page 2 even though current page is 1 — to ensure cycle navigation
    // would otherwise want to jump if hover triggered any navigation.
    useMarkupStore.setState({
      pageMarkups: { 2: [makeCount(2, 'Outlet', '#0078d4', 1)] },
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
        fireMouseEnter(row)
      })
      act(() => {
        fireMouseLeave(row)
      })
      expect(setPageSpy).not.toHaveBeenCalled()
    } finally {
      unmount()
    }
  })

  it('passing an empty currentPageMatches → hover still calls onHover with []', () => {
    const onHover = vi.fn()
    const { container, unmount } = mount(
      React.createElement(TotalsRow, {
        item: baseItem,
        cycleIndex: 0,
        currentPageMatches: [],
        onHover,
        onClick: vi.fn(),
        onContextMenu: vi.fn(),
        onTriggerPulse: vi.fn()
      })
    )
    try {
      const row = container.querySelector('[data-testid="totals-row"]') as HTMLElement
      act(() => {
        fireMouseEnter(row)
      })
      expect(onHover).toHaveBeenCalledTimes(1)
      expect(onHover.mock.calls[0][0]).toEqual([])
    } finally {
      unmount()
    }
  })
})
