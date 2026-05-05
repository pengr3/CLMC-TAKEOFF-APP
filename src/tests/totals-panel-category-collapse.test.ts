/** @vitest-environment jsdom */
/**
 * Render tests for TotalsCategoryBlock (plan 06-04) — D-13 collapse contract.
 *
 * Mirrors markup-context-menu.test.ts (React.createElement render harness
 * because vitest.config.ts include glob is *.test.ts, not *.test.tsx).
 *
 * Asserts:
 *   1. Heading click toggles collapsed state (items disappear / reappear).
 *   2. Collapse persists to localStorage `clmc.ui` under `collapsedCategories`.
 *   3. Chevron glyph shows ▸ when collapsed, ▾ when expanded (UI-SPEC §"Click a category heading").
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { TotalsCategoryBlock } from '@renderer/components/TotalsCategoryBlock'
import type { BoqCategoryGroup } from '@renderer/lib/boq-types'

// jsdom 29 in this project ships an experimental persistent localStorage that
// requires `--localstorage-file` — without a valid path, getItem/setItem are
// undefined. Replace with an in-memory polyfill scoped to this test file.
// Mirrors src/tests/use-ui-panels.test.ts.
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
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: ls
  })
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

const fixtureCategory: BoqCategoryGroup = {
  name: 'Electrical',
  items: [
    {
      label: 'Outlet',
      quantity: 12,
      uom: 'ea',
      color: '#0078d4',
      type: 'count'
    },
    {
      label: 'Switch',
      quantity: 5,
      uom: 'ea',
      color: '#d13438',
      type: 'count'
    }
  ],
  subtotals: [{ uom: 'ea', total: 17 }]
}

const noopHandlers = {
  onRowHover: vi.fn(),
  onRowClick: vi.fn(),
  onRowContextMenu: vi.fn()
}

beforeEach(() => {
  installLocalStoragePolyfill()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('TotalsCategoryBlock — D-13 collapse contract', () => {
  it('renders heading + items + subtotal expanded by default', () => {
    const { container, unmount } = mount(
      React.createElement(TotalsCategoryBlock, {
        category: fixtureCategory,
        pageMarkups: [],
        ...noopHandlers
      })
    )
    try {
      const heading = container.querySelector('[data-testid="totals-category-heading"]')
      expect(heading).not.toBeNull()
      expect(heading!.textContent).toContain('Electrical')

      const itemRows = container.querySelectorAll('[data-testid="totals-row"]')
      expect(itemRows.length).toBe(2)
      expect(itemRows[0].textContent).toContain('Outlet')
      expect(itemRows[1].textContent).toContain('Switch')

      const subtotal = container.querySelector('[data-testid="totals-subtotal-row"]')
      expect(subtotal).not.toBeNull()
      expect(subtotal!.textContent).toContain('Subtotal')
    } finally {
      unmount()
    }
  })

  it('shows ▾ chevron when expanded, ▸ when collapsed (UI-SPEC)', () => {
    const { container, unmount } = mount(
      React.createElement(TotalsCategoryBlock, {
        category: fixtureCategory,
        pageMarkups: [],
        ...noopHandlers
      })
    )
    try {
      const chevron = container.querySelector('[data-testid="totals-category-chevron"]')
      expect(chevron).not.toBeNull()
      // Expanded by default
      expect(chevron!.textContent).toBe('▾')

      const heading = container.querySelector(
        '[data-testid="totals-category-heading"]'
      ) as HTMLDivElement
      act(() => {
        heading.click()
      })
      const chevronAfter = container.querySelector('[data-testid="totals-category-chevron"]')
      expect(chevronAfter!.textContent).toBe('▸')
    } finally {
      unmount()
    }
  })

  it('heading click toggles collapsed state — items disappear and reappear', () => {
    const { container, unmount } = mount(
      React.createElement(TotalsCategoryBlock, {
        category: fixtureCategory,
        pageMarkups: [],
        ...noopHandlers
      })
    )
    try {
      // Initially expanded → 2 item rows + 1 subtotal in DOM.
      expect(container.querySelectorAll('[data-testid="totals-row"]').length).toBe(2)
      expect(container.querySelector('[data-testid="totals-subtotal-row"]')).not.toBeNull()

      const heading = container.querySelector(
        '[data-testid="totals-category-heading"]'
      ) as HTMLDivElement
      act(() => {
        heading.click()
      })

      // Collapsed → no item rows, no subtotal — heading still visible.
      expect(container.querySelectorAll('[data-testid="totals-row"]').length).toBe(0)
      expect(container.querySelector('[data-testid="totals-subtotal-row"]')).toBeNull()
      expect(container.querySelector('[data-testid="totals-category-heading"]')).not.toBeNull()

      act(() => {
        heading.click()
      })

      // Expanded again → rows return.
      expect(container.querySelectorAll('[data-testid="totals-row"]').length).toBe(2)
      expect(container.querySelector('[data-testid="totals-subtotal-row"]')).not.toBeNull()
    } finally {
      unmount()
    }
  })

  it('collapse persists to localStorage clmc.ui collapsedCategories', () => {
    const { container, unmount } = mount(
      React.createElement(TotalsCategoryBlock, {
        category: fixtureCategory,
        pageMarkups: [],
        ...noopHandlers
      })
    )
    try {
      const heading = container.querySelector(
        '[data-testid="totals-category-heading"]'
      ) as HTMLDivElement
      act(() => {
        heading.click()
      })

      const raw = window.localStorage.getItem('clmc.ui')
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      expect(parsed.collapsedCategories).toContain('Electrical')

      // Toggle off → should be removed from the array.
      act(() => {
        heading.click()
      })
      const raw2 = window.localStorage.getItem('clmc.ui')
      const parsed2 = JSON.parse(raw2!)
      expect(parsed2.collapsedCategories).not.toContain('Electrical')
    } finally {
      unmount()
    }
  })

  it('NO color on heading row (D-06) — no item.color chip in heading', () => {
    const { container, unmount } = mount(
      React.createElement(TotalsCategoryBlock, {
        category: fixtureCategory,
        pageMarkups: [],
        ...noopHandlers
      })
    )
    try {
      const heading = container.querySelector(
        '[data-testid="totals-category-heading"]'
      ) as HTMLDivElement
      // The TotalsRow color chip carries data-testid="totals-row-color-chip".
      // The heading must contain none of these — they are scoped to item rows.
      expect(heading.querySelector('[data-testid="totals-row-color-chip"]')).toBeNull()
    } finally {
      unmount()
    }
  })
})
