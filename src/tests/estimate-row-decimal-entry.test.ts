/** @vitest-environment jsdom */
/**
 * EstimateRow decimal-entry regression — Phase 16 CR-01 / WR-02.
 *
 * The 6 cases in estimate-row-edit.test.ts MOCK setPrice (vi.fn()), so the REAL
 * projectStore value never changes, the seed effect never re-fires with a new
 * value, and the mid-typing clobber path is never exercised. That blind spot let
 * CR-01 (rate cell wipes the user's input mid-typing on decimals / leading zeros)
 * and WR-02 (every keystroke marks the project dirty + writes a partial value)
 * ship green. This file closes that gap by driving the REAL setPrice + the REAL
 * seed effect and proving the clobber is gone.
 *
 * Harness models estimate-row-edit.test.ts VERBATIM (React.createElement + jsdom +
 * in-memory localStorage polyfill + native input/blur/keydown dispatch +
 * IS_REACT_ACT_ENVIRONMENT = true at module scope; parallel-executor-safe, no
 * vitest.config.ts change per CLAUDE.md / 16-RESEARCH Pitfall 6). The ONE
 * deliberate difference: beforeEach does NOT overwrite setPrice — the store's own
 * action (create()'d in projectStore.ts) stays in place so the seed effect sees
 * the true post-commit rates.
 *
 * Contract asserted (CR-01/WR-02 fix):
 *   1. Commit is DEFERRED to blur/Enter — the native 'input' event no longer
 *      commits, so typing does NOT write partial parseFloats to the store and does
 *      NOT flip isDirty per keystroke (WR-02).
 *   2. The seed effect NEVER overwrites the actively-focused cell — even when a
 *      store update lands while the user is mid-typing an interim value like '0.',
 *      the focused field keeps what the user typed instead of being reset to ''
 *      (CR-01, the core clobber).
 *   3. Typing a leading-zero decimal '0' → '0.' → '0.5' into the focused material
 *      cell leaves it reading '0.5' (never blanked), and blur commits
 *      rates['Outlet|count'].material === 0.5 through the real store.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { useViewerStore } from '@renderer/stores/viewerStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { BoqItemRow } from '@renderer/lib/boq-types'
import { EstimateRow } from '@renderer/components/EstimateRow'

// React 19 emits "act environment not configured" to stderr unless this flag is
// set. Per-test-file flag at module scope mirrors estimate-row-edit.test.ts:51 +
// the 8 sibling render tests (STATE.md locked decision). Parallel-executor-safe.
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

// Category-INDEPENDENT price key — `${name}|${type}` (Pitfall 4).
const PRICE_KEY = 'Outlet|count'

const outletItem: BoqItemRow = {
  label: 'Outlet',
  quantity: 3,
  uom: 'ea',
  material: 0, labor: 0, markup: 30,
  materialCost: 0, laborCost: 0, cost: 0, price: 0, margin: 0,
  color: '#0078d4',
  type: 'count',
  categoryId: 'cat-1'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as BoqItemRow

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
  // Reset ONLY the projectStore data — deliberately DO NOT replace setPrice with a
  // spy (that is what estimate-row-edit.test.ts does, and it is exactly the blind
  // spot that hid CR-01). The real create()'d setPrice + markDirty stay in place.
  useProjectStore.setState({ rates: {}, isDirty: false })
  document.body.innerHTML = ''
})

function findCell(container: HTMLElement, testid: string): HTMLInputElement | null {
  return container.querySelector(`[data-testid="${testid}"]`) as HTMLInputElement | null
}

describe('EstimateRow decimal entry — CR-01/WR-02 regression (real setPrice)', () => {
  it('does NOT commit or mark dirty on the native input event (WR-02)', () => {
    const { container, unmount } = mount(
      React.createElement(EstimateRow, {
        item: outletItem
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    )
    try {
      const input = findCell(container, 'estimate-row-material-input')
      expect(input).not.toBeNull()

      act(() => {
        input!.focus()
        input!.value = '42'
        // Per-keystroke 'input' must NOT commit any more.
        input!.dispatchEvent(new Event('input', { bubbles: true }))
      })

      // The store is untouched and the project is still clean until blur/Enter.
      expect(useProjectStore.getState().rates[PRICE_KEY]).toBeUndefined()
      expect(useProjectStore.getState().isDirty).toBe(false)

      // Blur commits — now (and only now) the store updates and dirty flips.
      act(() => {
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      expect(useProjectStore.getState().rates[PRICE_KEY]?.material).toBe(42)
      expect(useProjectStore.getState().isDirty).toBe(true)
    } finally {
      unmount()
    }
  })

  it('seed effect does NOT clobber a focused cell when the store updates mid-typing (CR-01 core)', () => {
    const { container, unmount } = mount(
      React.createElement(EstimateRow, {
        item: outletItem
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    )
    try {
      const input = findCell(container, 'estimate-row-material-input')
      expect(input).not.toBeNull()

      // User is mid-typing the interim value '0.' and the cell is focused.
      act(() => {
        input!.focus()
        input!.value = '0.'
      })
      expect(document.activeElement).toBe(input)

      // Simulate a store write landing while the field is focused (this is exactly
      // what the OLD per-keystroke commit did: parseFloat('0.') === 0 → material 0).
      // The seed effect re-runs with material: 0 → seedRateText(0) === '' — the OLD
      // code would set input.value = '' here, erasing the user's '0.'. The focus
      // guard must make this a no-op.
      act(() => {
        useProjectStore.getState().setPrice(PRICE_KEY, { material: 0 })
      })

      // CR-01: the focused field STILL reads what the user typed — not blanked.
      expect(input!.value).toBe('0.')
    } finally {
      unmount()
    }
  })

  it('typing a leading-zero decimal 0 -> 0. -> 0.5 survives, and blur commits material === 0.5', () => {
    const { container, unmount } = mount(
      React.createElement(EstimateRow, {
        item: outletItem
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    )
    try {
      const input = findCell(container, 'estimate-row-material-input')
      expect(input).not.toBeNull()

      // Type the decimal one stage at a time against the REAL store, exactly the
      // sequence the estimator makes for a 0.5 rate.
      act(() => {
        input!.focus()
        input!.value = '0'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
      })
      act(() => {
        input!.value = '0.'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
      })
      act(() => {
        input!.value = '0.5'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
      })

      // (a) The focused field was NEVER reset to '' — it still reads the full '0.5'
      // the user typed (the CR-01 clobber is gone). Nothing committed yet either.
      expect(input!.value).toBe('0.5')
      expect(useProjectStore.getState().rates[PRICE_KEY]).toBeUndefined()

      // (b) Blur commits the parsed decimal through the real store.
      act(() => {
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      expect(useProjectStore.getState().rates[PRICE_KEY]?.material).toBe(0.5)
    } finally {
      unmount()
    }
  })

  it('committing via Enter also lands the decimal (0.75) in the real store', () => {
    const { container, unmount } = mount(
      React.createElement(EstimateRow, {
        item: outletItem
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    )
    try {
      const input = findCell(container, 'estimate-row-material-input')
      expect(input).not.toBeNull()

      act(() => {
        input!.focus()
        input!.value = '0.75'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })

      expect(input!.value).toBe('0.75')
      expect(useProjectStore.getState().rates[PRICE_KEY]?.material).toBe(0.75)
    } finally {
      unmount()
    }
  })
})
