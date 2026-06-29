/** @vitest-environment jsdom */
/**
 * TotalsRow inline rate edit — Phase 15 RED render test (proof b: inline field).
 *
 * Mirrors the totals-row-cycle.test.ts harness (React.createElement + jsdom +
 * in-memory localStorage polyfill — the pattern shared across the totals-row
 * tests because vitest.config.ts include glob is *.test.ts only).
 *
 * Asserts the inline ₱ rate field contract that Plan 15-06 will build into
 * TotalsRow.tsx:
 *   1. Typing a number into the rate <input> (data-testid="totals-row-rate-input")
 *      and committing via change+blur — OR via keydown Enter — calls
 *      useProjectStore.getState().setRate with the category-INDEPENDENT key
 *      `${name}|${type}` (e.g. 'Outlet|count') and the parsed number.
 *   2. Interacting with the input does NOT fire the row's onArmTool prop and does
 *      NOT navigate pages (setPage), proving the input calls e.stopPropagation()
 *      so the row's onClick cycle/arm handler never runs (mirrors the lightbulb
 *      stopPropagation pattern at TotalsRow.tsx:241-251).
 *
 * ALL assertions are RED until Plan 15-06 adds the rate input. The file COMPILES
 * today (setRate is injected onto the store via `as any`; the input is queried
 * defensively). Do NOT "fix" TotalsRow to make this green — Wave 1-3 does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { TotalsRow } from '@renderer/components/TotalsRow'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { BoqItemRow } from '@renderer/lib/boq-types'

// React 19 emits "act environment not configured" to stderr unless this flag is
// set; the console.error noise can trip act-aware assertions. Per-test-file flag
// at module scope mirrors pulse-highlight-animation.test.ts:1 + 8 sibling render
// tests (STATE.md locked decision). Parallel-executor-safe — no vitest.config.ts
// change.
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

// Category-independent rate key — `${name}|${type}`.
const RATE_KEY = 'Outlet|count'

// Row for an 'Outlet' count in cat-1. The rate key derived from (name, type) is
// 'Outlet|count' — category-INDEPENDENT (the categoryId is NOT part of the key).
const outletItem: BoqItemRow = {
  label: 'Outlet',
  quantity: 3,
  uom: 'ea',
  color: '#0078d4',
  type: 'count',
  categoryId: 'cat-1'
}

let setRateSpy: ReturnType<typeof vi.fn>

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
  // Inject a spy setRate onto projectStore. The action does not exist yet (Plan
  // 15-04 adds it mirroring toggleHiddenItem); injecting a vi.fn() lets us assert
  // the (future) input wiring dispatches the correct key + parsed number.
  setRateSpy = vi.fn()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(useProjectStore as any).setState({ rates: {}, setRate: setRateSpy })
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

function findRateInput(container: HTMLElement): HTMLInputElement | null {
  return container.querySelector('[data-testid="totals-row-rate-input"]') as HTMLInputElement | null
}

describe('TotalsRow inline rate edit (Phase 15, proof b)', () => {
  it('renders a rate input with data-testid="totals-row-rate-input"', () => {
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
      // RED — TotalsRow has no rate input yet.
      expect(findRateInput(container)).not.toBeNull()
    } finally {
      unmount()
    }
  })

  it('change + blur commits the parsed number via setRate("Outlet|count", n)', () => {
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
      const input = findRateInput(container)
      expect(input).not.toBeNull()
      act(() => {
        input!.value = '42'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
        input!.dispatchEvent(new Event('change', { bubbles: true }))
        input!.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      })
      // Category-INDEPENDENT key 'Outlet|count' + parsed number 42.
      const calledCorrectly = setRateSpy.mock.calls.some(
        (c) => c[0] === RATE_KEY && c[1] === 42
      )
      expect(calledCorrectly).toBe(true)
    } finally {
      unmount()
    }
  })

  it('keydown Enter commits the parsed number via setRate("Outlet|count", n)', () => {
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
      const input = findRateInput(container)
      expect(input).not.toBeNull()
      act(() => {
        input!.value = '7'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })
      const calledCorrectly = setRateSpy.mock.calls.some(
        (c) => c[0] === RATE_KEY && c[1] === 7
      )
      expect(calledCorrectly).toBe(true)
    } finally {
      unmount()
    }
  })

  it('interacting with the rate input does NOT arm the tool or navigate pages (stopPropagation)', () => {
    const setPageSpy = vi.spyOn(useViewerStore.getState(), 'setPage')
    const onArmTool = vi.fn()
    const { container, unmount } = mount(
      React.createElement(TotalsRow, {
        item: outletItem,
        cycleIndex: 0,
        currentPageMatches: [],
        onHover: vi.fn(),
        onClick: vi.fn(),
        onContextMenu: vi.fn(),
        onTriggerPulse: vi.fn(),
        onArmTool
      })
    )
    try {
      const input = findRateInput(container)
      // RED — input does not exist yet; once it does, clicking/typing in it must
      // NOT bubble to the row's onClick (which calls onArmTool + setPage).
      expect(input).not.toBeNull()
      act(() => {
        input!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        input!.value = '5'
        input!.dispatchEvent(new Event('input', { bubbles: true }))
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })
      // The row's arm-tool + page navigation must NOT fire from input interaction.
      expect(onArmTool).not.toHaveBeenCalled()
      expect(setPageSpy).not.toHaveBeenCalled()
    } finally {
      unmount()
    }
  })
})
