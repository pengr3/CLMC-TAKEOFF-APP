/** @vitest-environment jsdom */
/**
 * EstimateRow inline cell edit — Phase 16 RED render test (proof d).
 *
 * Models the totals-row-rate-edit.test.ts harness VERBATIM (React.createElement
 * + jsdom + in-memory localStorage polyfill + native input/blur/keydown dispatch
 * + IS_REACT_ACT_ENVIRONMENT = true at module scope — the pattern shared across
 * the render tests because vitest.config.ts include glob is *.test.ts only, and
 * jsdom 29 needs the localStorage polyfill; parallel-executor-safe, no config
 * change per CLAUDE.md / 16-RESEARCH Pitfall 6).
 *
 * Asserts the NEW Estimate-grid editable-cell contract that Wave 2a (16-04) will
 * build into EstimateRow.tsx (16-RESEARCH "Estimate grid editable cell", D-07):
 *   1. Typing a number into the Material cell (data-testid="estimate-row-material-input")
 *      and committing via a native `input` event then `blur` — OR via keydown
 *      Enter — calls useProjectStore.getState().setPrice with the category-
 *      INDEPENDENT key `${name}|${type}` (e.g. 'Outlet|count') and a partial
 *      patch { material: <parsed> } (Pitfall 4 — the price key is name|type, NOT
 *      name|categoryId).
 *   2. The Labor cell (estimate-row-labor-input) dispatches setPrice(key, { labor }).
 *   3. The Markup cell (estimate-row-markup-input) dispatches setPrice(key, { markup }).
 *   4. Interacting with a cell does NOT bubble to a parent listener (the cell
 *      calls e.stopPropagation(), mirroring the TotalsRow lightbulb pattern) — a
 *      spy passed as the `onRowClick` prop AND a listener attached to the row's
 *      parent container are both asserted NOT called.
 *
 * The component does not exist yet — EstimateRow is loaded via a runtime dynamic
 * import (loadEstimateRow) so the FILE COLLECTS and the missing-module failure
 * surfaces as a per-test RED (not a file-transform crash). `npm run typecheck`
 * stays clean (src/tests is outside every tsconfig `include`, and the dynamic
 * import is @vite-ignore'd with a computed specifier). ALL assertions are RED
 * until Wave 2a adds EstimateRow. Do NOT "fix" the source to make this green —
 * Wave 1-3 does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { useViewerStore } from '@renderer/stores/viewerStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { BoqItemRow } from '@renderer/lib/boq-types'

// React 19 emits "act environment not configured" to stderr unless this flag is
// set; the console.error noise can trip act-aware assertions. Per-test-file flag
// at module scope mirrors totals-row-rate-edit.test.ts:41 + 8 sibling render
// tests (STATE.md locked decision). Parallel-executor-safe — no vitest.config.ts
// change.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Runtime dynamic import of the not-yet-existent EstimateRow. A static
 * `import { EstimateRow } from '@renderer/components/EstimateRow'` would fail the
 * Vite transform and collect ZERO tests (a brittle load-time crash). A computed,
 * @vite-ignore'd specifier defers resolution to test-execution time, so the file
 * collects and each test fails with a clean "Cannot find package" RED until Wave
 * 2a creates the component. `npm run typecheck` is unaffected (tests are outside
 * every tsconfig include).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadEstimateRow(): Promise<any> {
  const spec = ['@renderer', 'components', 'EstimateRow'].join('/')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = (await import(/* @vite-ignore */ spec)) as any
  return mod.EstimateRow
}

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

// Category-INDEPENDENT price key — `${name}|${type}` (Pitfall 4). DISTINCT from
// the visibility key `${name}|${categoryId}`.
const PRICE_KEY = 'Outlet|count'

// Row for an 'Outlet' count in cat-1. The price key derived from (name, type) is
// 'Outlet|count' — the categoryId is NOT part of the key.
const outletItem: BoqItemRow = {
  label: 'Outlet',
  quantity: 3,
  uom: 'ea',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  material: 0, labor: 0, markup: 30,
  materialCost: 0, laborCost: 0, cost: 0, price: 0, margin: 0,
  color: '#0078d4',
  type: 'count',
  categoryId: 'cat-1'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as BoqItemRow

// A PRICED row for the read-only UNIT PRICE / TOTAL columns (UAT 2026-07-01).
// material 5 + labor 3 = cost/unit 8; ×(1 + 30/100) = 10.4 unit price. quantity 4
// ⇒ cost 32, price (TOTAL) 41.6, margin 9.6. UNIT PRICE (10.4) === price/qty
// (41.6 / 4). The read-only cells render straight off item.* (rates stay {} in
// beforeEach), so the fixture drives them directly.
const pricedItem: BoqItemRow = {
  label: 'Panel',
  quantity: 4,
  uom: 'ea',
  material: 5, labor: 3, markup: 30,
  materialCost: 20, laborCost: 12, cost: 32, price: 41.6, margin: 9.6,
  color: '#0078d4',
  type: 'count',
  categoryId: 'cat-1'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as BoqItemRow

let setPriceSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  installLocalStoragePolyfill()
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
  // Inject a spy setPrice onto projectStore. The action does not exist yet (Wave
  // 1 adds it, merging a Partial<PriceEntry> patch into the existing entry);
  // injecting a vi.fn() lets us assert the (future) cell wiring dispatches the
  // correct key + partial patch.
  setPriceSpy = vi.fn()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(useProjectStore as any).setState({ rates: {}, setPrice: setPriceSpy })
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

function findCell(container: HTMLElement, testid: string): HTMLInputElement | null {
  return container.querySelector(`[data-testid="${testid}"]`) as HTMLInputElement | null
}

/** Read-only ₱ cell text (UNIT PRICE / TOTAL / etc.) — these are <span>s, not inputs. */
function cellText(container: HTMLElement, testid: string): string | null {
  const el = container.querySelector(`[data-testid="${testid}"]`)
  return el ? (el.textContent ?? '') : null
}

/** Was setPrice(PRICE_KEY, patch) called with a patch whose field === value? */
function calledWith(field: 'material' | 'labor' | 'markup', value: number): boolean {
  return setPriceSpy.mock.calls.some((c) => {
    const [key, patch] = c as [string, Record<string, number>]
    return key === PRICE_KEY && patch != null && patch[field] === value
  })
}

describe('EstimateRow inline cell edit (Phase 16, proof d)', () => {
  it('renders material/labor/markup cell inputs with their data-testids', async () => {
    const EstimateRow = await loadEstimateRow()
    const { container, unmount } = mount(
      React.createElement(EstimateRow, {
        item: outletItem,
        onRowClick: vi.fn()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    )
    try {
      // RED — EstimateRow does not exist yet, so loadEstimateRow throws before we
      // ever reach here. Once it exists, the three cells must be present.
      expect(findCell(container, 'estimate-row-material-input')).not.toBeNull()
      expect(findCell(container, 'estimate-row-labor-input')).not.toBeNull()
      expect(findCell(container, 'estimate-row-markup-input')).not.toBeNull()
    } finally {
      unmount()
    }
  })

  it('renders a READ-ONLY UNIT PRICE cell = (material+labor)×(1+markup/100) == price/qty (UAT 2026-07-01)', async () => {
    const EstimateRow = await loadEstimateRow()
    const { container, unmount } = mount(
      React.createElement(EstimateRow, {
        item: pricedItem,
        onRowClick: vi.fn()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    )
    try {
      // UNIT PRICE cell is present, read-only (a <span>, NOT an <input>), and shows
      // the computed per-unit client price ₱10.40 for material 5 / labor 3 / markup 30
      // (8 × 1.3 = 10.4). It equals price/qty (41.6 / 4 = 10.4).
      const unitPriceText = cellText(container, 'estimate-row-unit-price')
      expect(unitPriceText).toBe('₱10.40')
      expect(container.querySelector('[data-testid="estimate-row-unit-price"]')?.tagName).toBe('SPAN')
      const perUnitFromTotal = pricedItem.price / pricedItem.quantity // 41.6 / 4 = 10.4
      expect(`₱${perUnitFromTotal.toFixed(2)}`).toBe('₱10.40')
    } finally {
      unmount()
    }
  })

  it('client total is now headed TOTAL (renamed from Price) and still shows item.price (UAT 2026-07-01)', async () => {
    const EstimateRow = await loadEstimateRow()
    const { container, unmount } = mount(
      React.createElement(EstimateRow, {
        item: pricedItem,
        onRowClick: vi.fn()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    )
    try {
      // The renamed cell carries the new testid `estimate-row-total` and shows the
      // SAME value the old "Price" cell showed — item.price (₱41.60). The old
      // `estimate-row-price` testid is gone.
      expect(cellText(container, 'estimate-row-total')).toBe('₱41.60')
      expect(container.querySelector('[data-testid="estimate-row-price"]')).toBeNull()
    } finally {
      unmount()
    }
  })

  it('material cell: native input + blur commits setPrice("Outlet|count", { material })', async () => {
    const EstimateRow = await loadEstimateRow()
    const { container, unmount } = mount(
      React.createElement(EstimateRow, {
        item: outletItem,
        onRowClick: vi.fn()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    )
    try {
      const input = findCell(container, 'estimate-row-material-input')
      expect(input).not.toBeNull()
      act(() => {
        input!.value = '42'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      // Category-INDEPENDENT key 'Outlet|count' + partial patch { material: 42 }.
      expect(calledWith('material', 42)).toBe(true)
    } finally {
      unmount()
    }
  })

  it('material cell: keydown Enter commits setPrice("Outlet|count", { material })', async () => {
    const EstimateRow = await loadEstimateRow()
    const { container, unmount } = mount(
      React.createElement(EstimateRow, {
        item: outletItem,
        onRowClick: vi.fn()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    )
    try {
      const input = findCell(container, 'estimate-row-material-input')
      expect(input).not.toBeNull()
      act(() => {
        input!.value = '7'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })
      expect(calledWith('material', 7)).toBe(true)
    } finally {
      unmount()
    }
  })

  it('labor cell: dispatches setPrice("Outlet|count", { labor })', async () => {
    const EstimateRow = await loadEstimateRow()
    const { container, unmount } = mount(
      React.createElement(EstimateRow, {
        item: outletItem,
        onRowClick: vi.fn()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    )
    try {
      const input = findCell(container, 'estimate-row-labor-input')
      expect(input).not.toBeNull()
      act(() => {
        input!.value = '9'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      expect(calledWith('labor', 9)).toBe(true)
    } finally {
      unmount()
    }
  })

  it('markup cell: dispatches setPrice("Outlet|count", { markup })', async () => {
    const EstimateRow = await loadEstimateRow()
    const { container, unmount } = mount(
      React.createElement(EstimateRow, {
        item: outletItem,
        onRowClick: vi.fn()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    )
    try {
      const input = findCell(container, 'estimate-row-markup-input')
      expect(input).not.toBeNull()
      act(() => {
        input!.value = '45'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })
      expect(calledWith('markup', 45)).toBe(true)
    } finally {
      unmount()
    }
  })

  it('interacting with a cell does NOT bubble to a parent listener or onRowClick (stopPropagation)', async () => {
    const EstimateRow = await loadEstimateRow()
    const onRowClick = vi.fn()
    const { container, unmount } = mount(
      React.createElement(EstimateRow, {
        item: outletItem,
        onRowClick
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    )
    try {
      // Attach a listener on the row's PARENT container — a click/keydown inside a
      // cell must NOT reach it (the cell calls e.stopPropagation()). The grid is a
      // spreadsheet, so a keydown-in-cell must not propagate to a parent listener.
      const parentClick = vi.fn()
      const parentKey = vi.fn()
      container.addEventListener('click', parentClick)
      container.addEventListener('keydown', parentKey)

      const input = findCell(container, 'estimate-row-material-input')
      expect(input).not.toBeNull()
      act(() => {
        input!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        input!.value = '5'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })

      // Neither the row's onRowClick nor the parent-container listeners fire from
      // in-cell interaction.
      expect(onRowClick).not.toHaveBeenCalled()
      expect(parentClick).not.toHaveBeenCalled()
      expect(parentKey).not.toHaveBeenCalled()
    } finally {
      unmount()
    }
  })
})
