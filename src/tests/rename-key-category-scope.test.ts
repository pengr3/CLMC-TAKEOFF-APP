/** @vitest-environment jsdom */
/**
 * MD-01 regression — the inline-rename identity is scoped by CATEGORY.
 *
 * A single name-group can legitimately span two categories (SPEC/CONTEXT "Pitfall 3":
 * a same-name group under two categoryIds, reachable via the single-markup category
 * edit or the moveGroup multi-category collapse). Before this fix, `renamingKey` and
 * each row's key were the bare `name|type` string, so the SAME string was the rowKey
 * of TWO rows (one per category block). Double-clicking (or "Rename" from the context
 * menu on) either row mounted InlineRenameInput TWICE — both auto-focusing and racing
 * for keyboard focus, and the stale second editor then reported a phantom collision.
 *
 * These tests seed a "Slab" count group that spans two categories and assert exactly
 * ONE editor mounts for the row the user actually interacted with (double-click AND
 * context-menu paths). Harness mirrors totals-row-group-ops.test.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

import { TotalsPanel } from '@renderer/components/TotalsPanel'
import { useViewerStore } from '@renderer/stores/viewerStore'
import { useScaleStore } from '@renderer/stores/scaleStore'
import { useMarkupStore } from '@renderer/stores/markupStore'
import { DEFAULT_UNIT } from '@renderer/types/scale'
import type { CountMarkup } from '@renderer/types/markup'

// React 19 emits "act environment not configured" unless this flag is set.
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

function makeCount(page: number, name: string, categoryId: string, sequence: number): CountMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'count',
    page,
    name,
    categoryId,
    color: '#0078d4',
    sequence,
    point: { x: 10, y: 20 },
    createdAt: Date.now()
  }
}

function findMenuItem(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button[role="menuitem"]')).find(
    (b) => b.textContent === text
  ) as HTMLButtonElement | undefined
}

const baseProps = {
  open: true,
  width: 320,
  onSetOpen: vi.fn()
}

beforeEach(() => {
  installLocalStoragePolyfill()
  useViewerStore.setState({
    filePath: '/test.pdf',
    fileName: 'test.pdf',
    currentPage: 1,
    totalPages: 1,
    pageViewports: {},
    pdfDocument: null
  })
  useScaleStore.setState({ pageScales: {}, globalUnit: DEFAULT_UNIT, calibMode: 'idle' })
  // One "Slab" count group that SPANS two categories (Pitfall 3): a Slab count in
  // "Electrical" (cat-1) AND a Slab count in "Structural" (cat-2). The aggregator
  // yields two category blocks, each with a "Slab" row sharing the same name|type.
  useMarkupStore.setState({
    pageMarkups: { 1: [makeCount(1, 'Slab', 'cat-1', 1), makeCount(1, 'Slab', 'cat-2', 1)] },
    categories: {
      'cat-1': { id: 'cat-1', name: 'Electrical', color: '#0078d4', paletteIndex: 0 },
      'cat-2': { id: 'cat-2', name: 'Structural', color: '#d40078', paletteIndex: 1 }
    },
    categoryOrder: ['cat-1', 'cat-2'],
    categoryItemOrder: {},
    undoStack: [],
    redoStack: []
  })
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('MD-01: inline rename identity is category-scoped (group spans two categories)', () => {
  it('two category blocks each render a "Slab" row (precondition)', () => {
    const { container, unmount } = mount(React.createElement(TotalsPanel, baseProps))
    try {
      const rows = container.querySelectorAll('[data-testid="totals-row"]')
      expect(rows.length).toBe(2)
      const labels = Array.from(
        container.querySelectorAll('[data-testid="totals-row-label"]')
      ).map((el) => el.textContent)
      expect(labels).toEqual(['Slab', 'Slab'])
    } finally {
      unmount()
    }
  })

  it('double-clicking ONE row opens exactly ONE inline rename editor', () => {
    const { container, unmount } = mount(React.createElement(TotalsPanel, baseProps))
    try {
      // Before: no editor mounted.
      expect(container.querySelectorAll('input[aria-label="Rename Slab"]').length).toBe(0)

      // Double-click the label of the FIRST (Electrical) block's Slab row.
      const electricalLabel = container.querySelector(
        '[data-category-name="Electrical"] [data-testid="totals-row-label"]'
      ) as HTMLElement
      expect(electricalLabel).not.toBeNull()
      act(() => {
        electricalLabel.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      })

      // Exactly ONE editor mounts — the row the user double-clicked (category-scoped key).
      expect(container.querySelectorAll('input[aria-label="Rename Slab"]').length).toBe(1)
    } finally {
      unmount()
    }
  })

  it('context-menu Rename on ONE row opens exactly ONE inline rename editor', () => {
    const { container, unmount } = mount(React.createElement(TotalsPanel, baseProps))
    try {
      // Right-click the first (Electrical) Slab row to open the shared context menu.
      const firstRow = container.querySelector(
        '[data-category-name="Electrical"] [data-testid="totals-row"]'
      ) as HTMLElement
      expect(firstRow).not.toBeNull()
      act(() => {
        firstRow.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 60 })
        )
      })
      act(() => {
        findMenuItem(container, 'Rename')!.click()
      })

      // Exactly ONE editor mounts — the row the user right-clicked, not both.
      expect(container.querySelectorAll('input[aria-label="Rename Slab"]').length).toBe(1)
    } finally {
      unmount()
    }
  })
})
