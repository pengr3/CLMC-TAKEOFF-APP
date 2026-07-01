/** @vitest-environment jsdom */
/**
 * Totals panel quantity-only revert — Phase 16 RED render test (proof e, D-02).
 *
 * Mirrors the totals-row-cycle.test.ts harness (React.createElement + jsdom +
 * in-memory localStorage polyfill + IS_REACT_ACT_ENVIRONMENT = true at module
 * scope — the pattern shared across the totals-row render tests; vitest.config.ts
 * include glob is *.test.ts only, and jsdom 29 needs the localStorage polyfill;
 * parallel-executor-safe, no config change per CLAUDE.md / 16-RESEARCH Pitfall 6).
 *
 * D-02 reverts the totals panel to QUANTITY ONLY. This asserts the Phase-15
 * pricing render nodes are ABSENT and the surviving quantity/visibility nodes are
 * PRESENT:
 *   ABSENT  — totals-row-rate-input, totals-row-cost (on TotalsRow),
 *             totals-category-cost-subtotal (on TotalsCategoryBlock),
 *             totals-grand-total (on TotalsPanel).
 *   PRESENT — totals-row-quantity, totals-row-lightbulb, totals-row-color-chip.
 *
 * ALL "absent" assertions are RED today: TotalsRow still renders the rate input
 * (:413) + cost span (:439), TotalsCategoryBlock still renders the cost subtotal
 * (:136), and TotalsPanel still renders the grand-total bar (:274). They turn
 * GREEN when Wave 2b (16-06) strips those nodes (16-RESEARCH "Removal Map"). Do
 * NOT "fix" the source to make these green — Wave 1-3 does. The components exist
 * today, so the render itself is clean; only the pricing nodes are the RED.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { TotalsRow } from '@renderer/components/TotalsRow'
import { TotalsCategoryBlock } from '@renderer/components/TotalsCategoryBlock'
import { TotalsPanel } from '@renderer/components/TotalsPanel'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { BoqItemRow, BoqCategoryGroup } from '@renderer/lib/boq-types'
import type { CountMarkup } from '@renderer/types/markup'

// React 19 emits "act environment not configured" unless this flag is set. Per-
// test-file flag at module scope mirrors the sibling render tests (STATE.md
// locked decision). Parallel-executor-safe — no vitest.config.ts change.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

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

function installLocalStoragePolyfill(): void {
  const store = new Map<string, string>()
  const ls: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v))
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: ls })
}

function countMarkup(opts: { id: string; page: number; name: string; categoryId: string; color: string }): CountMarkup {
  return {
    id: opts.id, type: 'count', page: opts.page, name: opts.name,
    categoryId: opts.categoryId, color: opts.color, createdAt: 0,
    point: { x: 0, y: 0 }, sequence: 1
  }
}

// A priced Outlet row (the Phase-15 shape). The pricing render nodes must be gone
// regardless of whether the row carries rate/cost data.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const outletItem = {
  label: 'Outlet',
  quantity: 3,
  uom: 'ea',
  color: '#0078d4',
  type: 'count',
  categoryId: 'cat-1',
  rate: 5,
  cost: 15
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as BoqItemRow

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const outletCategory = {
  name: 'Electrical',
  items: [outletItem],
  subtotals: [{ uom: 'ea', total: 3 }],
  costSubtotal: 15
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as BoqCategoryGroup

function has(container: HTMLElement, testid: string): boolean {
  return container.querySelector(`[data-testid="${testid}"]`) !== null
}

beforeEach(() => {
  installLocalStoragePolyfill()
  useViewerStore.setState({
    currentPage: 1,
    totalPages: 5,
    pageViewports: {},
    pageScales: {}
  })
  useMarkupStore.setState({
    pageMarkups: { 1: [countMarkup({ id: 'o1', page: 1, name: 'Outlet', categoryId: 'cat-1', color: '#0078d4' })] },
    categories: { 'cat-1': { id: 'cat-1', name: 'Electrical', color: '#0078d4', paletteIndex: 0 } },
    categoryOrder: ['cat-1'],
    undoStack: [],
    redoStack: []
  })
  useScaleStore.setState({ pageScales: { 1: { pixelsPerMm: 1, displayUnit: 'mm' } }, globalUnit: 'mm' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(useProjectStore as any).setState({ rates: {} })
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('Totals panel quantity-only revert (Phase 16, proof e, D-02)', () => {
  it('TotalsRow renders NO rate input and NO cost node (pricing removed)', () => {
    const { container, unmount } = mount(
      React.createElement(TotalsRow, {
        item: outletItem,
        cycleIndex: 0,
        currentPageMatches: [],
        onHover: vi.fn(),
        onClick: vi.fn(),
        onContextMenu: vi.fn(),
        onTriggerPulse: vi.fn(),
        onArmTool: vi.fn()
      })
    )
    try {
      // RED — TotalsRow still renders these Phase-15 pricing nodes today.
      expect(has(container, 'totals-row-rate-input')).toBe(false)
      expect(has(container, 'totals-row-cost')).toBe(false)
    } finally {
      unmount()
    }
  })

  it('TotalsRow KEEPS quantity + lightbulb + color chip (survivors present)', () => {
    const { container, unmount } = mount(
      React.createElement(TotalsRow, {
        item: outletItem,
        cycleIndex: 0,
        currentPageMatches: [],
        onHover: vi.fn(),
        onClick: vi.fn(),
        onContextMenu: vi.fn(),
        onTriggerPulse: vi.fn(),
        onArmTool: vi.fn()
      })
    )
    try {
      // These survive D-02 and must stay present (GREEN today, stays GREEN).
      expect(has(container, 'totals-row-quantity')).toBe(true)
      expect(has(container, 'totals-row-lightbulb')).toBe(true)
      expect(has(container, 'totals-row-color-chip')).toBe(true)
    } finally {
      unmount()
    }
  })

  it('TotalsCategoryBlock renders NO cost subtotal node', () => {
    const { container, unmount } = mount(
      React.createElement(TotalsCategoryBlock, {
        category: outletCategory,
        pageMarkups: [],
        onRowHover: vi.fn(),
        onRowClick: vi.fn(),
        onRowContextMenu: vi.fn(),
        onTriggerPulse: vi.fn(),
        onArmTool: vi.fn()
      })
    )
    try {
      // RED — TotalsCategoryBlock still renders the per-category cost subtotal.
      expect(has(container, 'totals-category-cost-subtotal')).toBe(false)
    } finally {
      unmount()
    }
  })

  it('TotalsPanel renders NO grand-total cost bar', () => {
    const { container, unmount } = mount(
      React.createElement(TotalsPanel, {
        open: true,
        width: 320,
        onSetOpen: vi.fn(),
        onRowHover: vi.fn(),
        onRowClick: vi.fn(),
        onRowContextMenu: vi.fn(),
        onTriggerPulse: vi.fn(),
        onArmTool: vi.fn()
      })
    )
    try {
      // RED — TotalsPanel still renders the pinned grand-total ₱ bar today.
      expect(has(container, 'totals-grand-total')).toBe(false)
    } finally {
      unmount()
    }
  })
})
