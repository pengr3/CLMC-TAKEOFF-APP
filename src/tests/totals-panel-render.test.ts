/** @vitest-environment jsdom */
/**
 * Render tests for TotalsPanel (plan 06-04) — VIEW-01 / D-06 / D-09 contract.
 *
 * Mirrors markup-context-menu.test.ts (React.createElement render harness
 * because vitest.config.ts include glob is *.test.ts, not *.test.tsx).
 *
 * Covers:
 *   1. Renders item rows from BoqStructure with correct labels (VIEW-01).
 *   2. Renders item color chip from item.color (D-06).
 *   3. Quantity right-aligned with tabular-nums.
 *   4. Grand-total bar pinned at the bottom with per-UoM totals.
 *   5. Header shows live currentPage from viewerStore (not from BoqMetadata).
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

function makeCountMarkup(page: number, name: string, color: string, sequence: number): CountMarkup {
  return {
    id: crypto.randomUUID(),
    type: 'count',
    page,
    name,
    categoryId: 'cat-1',
    color,
    sequence,
    point: { x: 10, y: 20 },
    createdAt: Date.now()
  }
}

beforeEach(() => {
  installLocalStoragePolyfill()
  // Clean store baselines so useBoqLive sees the fixture state we install per test.
  useViewerStore.setState({
    filePath: null,
    fileName: null,
    currentPage: 1,
    totalPages: 0,
    pageViewports: {},
    pdfDocument: null
  })
  useScaleStore.setState({ pageScales: {}, globalUnit: DEFAULT_UNIT, calibMode: 'idle' })
  useMarkupStore.setState({
    pageMarkups: {},
    categories: {},
    categoryOrder: [],
    undoStack: [],
    redoStack: []
  })
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

const baseProps = {
  open: true,
  width: 320,
  onSetOpen: vi.fn()
}

describe('TotalsPanel — VIEW-01 render', () => {
  it('renders item rows from BoqStructure with correct labels (VIEW-01)', () => {
    // Seed: 1 page open, 2 categories with 3 items via 3 count markups.
    useViewerStore.setState({
      filePath: '/test.pdf',
      fileName: 'test.pdf',
      currentPage: 1,
      totalPages: 1,
      pageViewports: {},
      pdfDocument: null
    })
    useMarkupStore.setState({
      pageMarkups: {
        1: [
          makeCountMarkup(1, 'Outlet', '#0078d4', 1),
          makeCountMarkup(1, 'Outlet', '#0078d4', 2),
          makeCountMarkup(1, 'Switch', '#d13438', 1),
          makeCountMarkup(1, 'Door', '#107c10', 1)
        ]
      },
      categories: {
        'cat-1': { id: 'cat-1', name: 'Electrical', color: '#0078d4', paletteIndex: 0 }
      },
      categoryOrder: ['cat-1'],
      undoStack: [],
      redoStack: []
    })
    // Force markup-store name→color resolution to use the per-name first-seen color.
    // (The aggregator uses getColorForName via useMarkupStore.getState() — already
    // satisfied by setState above.)

    const { container, unmount } = mount(React.createElement(TotalsPanel, baseProps))
    try {
      const rows = container.querySelectorAll('[data-testid="totals-row"]')
      // Three distinct names → three rows.
      expect(rows.length).toBe(3)
      const labels = Array.from(rows).map((r) => r.getAttribute('data-item-label'))
      expect(labels).toContain('Outlet')
      expect(labels).toContain('Switch')
      expect(labels).toContain('Door')
    } finally {
      unmount()
    }
  })

  it('renders item color chip from item.color (D-06)', () => {
    useViewerStore.setState({
      filePath: '/test.pdf',
      fileName: 'test.pdf',
      currentPage: 1,
      totalPages: 1,
      pageViewports: {},
      pdfDocument: null
    })
    useMarkupStore.setState({
      pageMarkups: {
        1: [makeCountMarkup(1, 'Outlet', '#0078d4', 1)]
      },
      categories: {
        'cat-1': { id: 'cat-1', name: 'Electrical', color: '#0078d4', paletteIndex: 0 }
      },
      categoryOrder: ['cat-1'],
      undoStack: [],
      redoStack: []
    })

    const { container, unmount } = mount(React.createElement(TotalsPanel, baseProps))
    try {
      const chips = container.querySelectorAll('[data-testid="totals-row-color-chip"]')
      // Exactly one chip per item row (D-06 — chip ONLY on item-name cell).
      expect(chips.length).toBe(1)
      const chipStyle = (chips[0] as HTMLElement).style
      // jsdom normalizes inline #0078d4 → rgb(0, 120, 212).
      // Accept either the original hex (raw style attr) or the normalized rgb.
      const bg = chipStyle.background.toLowerCase()
      const matches =
        bg.includes('#0078d4') || bg.includes('rgb(0, 120, 212)') || bg.includes('rgb(0,120,212)')
      expect(matches).toBe(true)
    } finally {
      unmount()
    }
  })

  it('quantity is right-aligned with tabular-nums', () => {
    useViewerStore.setState({
      filePath: '/test.pdf',
      fileName: 'test.pdf',
      currentPage: 1,
      totalPages: 1,
      pageViewports: {},
      pdfDocument: null
    })
    useMarkupStore.setState({
      pageMarkups: {
        1: [
          makeCountMarkup(1, 'Outlet', '#0078d4', 1),
          makeCountMarkup(1, 'Outlet', '#0078d4', 2),
          makeCountMarkup(1, 'Outlet', '#0078d4', 3)
        ]
      },
      categories: {
        'cat-1': { id: 'cat-1', name: 'Electrical', color: '#0078d4', paletteIndex: 0 }
      },
      categoryOrder: ['cat-1'],
      undoStack: [],
      redoStack: []
    })

    const { container, unmount } = mount(React.createElement(TotalsPanel, baseProps))
    try {
      const qty = container.querySelector('[data-testid="totals-row-quantity"]') as HTMLElement
      expect(qty).not.toBeNull()
      expect(qty.style.fontVariantNumeric).toBe('tabular-nums')
      expect(qty.style.textAlign).toBe('right')
      expect(qty.textContent).toBe('3')
    } finally {
      unmount()
    }
  })

  it('grand-total bar shows per-UoM totals at the bottom', () => {
    useViewerStore.setState({
      filePath: '/test.pdf',
      fileName: 'test.pdf',
      currentPage: 1,
      totalPages: 1,
      pageViewports: {},
      pdfDocument: null
    })
    useMarkupStore.setState({
      pageMarkups: {
        1: [makeCountMarkup(1, 'Outlet', '#0078d4', 1), makeCountMarkup(1, 'Outlet', '#0078d4', 2)]
      },
      categories: {
        'cat-1': { id: 'cat-1', name: 'Electrical', color: '#0078d4', paletteIndex: 0 }
      },
      categoryOrder: ['cat-1'],
      undoStack: [],
      redoStack: []
    })

    const { container, unmount } = mount(React.createElement(TotalsPanel, baseProps))
    try {
      const bar = container.querySelector('[data-testid="totals-panel-grand-total"]')
      expect(bar).not.toBeNull()
      expect(bar!.textContent).toContain('Total')
      // 2 outlets → grand total per uom 'ea' = 2.00
      expect(bar!.textContent).toContain('2.00')
      expect(bar!.textContent).toContain('ea')
    } finally {
      unmount()
    }
  })

  it('header shows live currentPage from viewerStore (not from BoqMetadata)', () => {
    useViewerStore.setState({
      filePath: '/test.pdf',
      fileName: 'test.pdf',
      currentPage: 3,
      totalPages: 5,
      pageViewports: {},
      pdfDocument: null
    })
    useMarkupStore.setState({
      pageMarkups: {},
      categories: {},
      categoryOrder: [],
      undoStack: [],
      redoStack: []
    })

    const { container, unmount } = mount(React.createElement(TotalsPanel, baseProps))
    try {
      const header = container.querySelector('[data-testid="totals-panel-header"]')
      expect(header).not.toBeNull()
      // Page row uses the LIVE currentPage = 3 (not from aggregator metadata).
      const rowTexts = Array.from(
        header!.querySelectorAll('[data-testid="totals-panel-header-row"]')
      ).map((r) => r.textContent ?? '')
      const pageRow = rowTexts.find((t) => t.includes('Page:'))
      expect(pageRow).toBeDefined()
      expect(pageRow).toContain('3')
    } finally {
      unmount()
    }
  })

  it('renders collapsed rail with Expand Totals button when open=false', () => {
    useViewerStore.setState({
      filePath: '/test.pdf',
      fileName: 'test.pdf',
      currentPage: 1,
      totalPages: 1,
      pageViewports: {},
      pdfDocument: null
    })

    const onSetOpen = vi.fn()
    const { container, unmount } = mount(
      React.createElement(TotalsPanel, {
        ...baseProps,
        open: false,
        onSetOpen
      })
    )
    try {
      const rail = container.querySelector('[data-testid="totals-panel-rail"]')
      expect(rail).not.toBeNull()
      const btn = rail!.querySelector('button[aria-label="Expand Totals"]') as HTMLButtonElement
      expect(btn).not.toBeNull()
      act(() => {
        btn.click()
      })
      expect(onSetOpen).toHaveBeenCalledWith(true)
    } finally {
      unmount()
    }
  })
})
